import eventBus from '../core/event-bus';
import network from './network';
import database, {Database} from '../database/database';
import task from '../core/task';
import config from '../config/config';
import async from 'async';


export class Peer {
    constructor() {
        this._proxyAdvertisementRequestQueue = {};
        this._advertisementRequestQueue      = {};
        this.protocolAddressKeyIdentifier    = null;
    }

    _onNewAdvertisement(data) {
        if (this._proxyAdvertisementRequestQueue[data.request_guid]) {
            const ws      = this._proxyAdvertisementRequestQueue[data.request_guid].ws;
            const payload = {
                type   : 'advertisement_new',
                content: data
            };
            ws.send(JSON.stringify(payload));
            return;
        }
        else if (!this._advertisementRequestQueue[data.request_guid]) {
            return;
        }

        const {
                  advertisement_list: advertisements,
                  node_id           : nodeID,
                  node_ip_address   : nodeIPAddress,
                  node_port         : nodePort,
                  request_guid      : requestGUID
              } = data;
        console.log(`[peer] new advertisements ${JSON.stringify(advertisements, null, 4)}`);
        const consumerRepository = database.getRepository('consumer');
        async.eachSeries(advertisements, (advertisement, callback) => {
            consumerRepository.addAdvertisement(advertisement, nodeID, nodeIPAddress, nodePort, requestGUID)
                              .then(() => callback())
                              .catch(() => callback());
        });
    }

    _onNewPeer(peer, ws) {
        eventBus.emit('tangled_event_log', {
            type   : 'new_peer',
            content: peer,
            from   : ws.node
        });

        network.addNode(peer.node_prefix, peer.node_address, peer.node_port, peer.node_id);
    }

    _onAdvertisementRequest(data, ws) {
        if (this._proxyAdvertisementRequestQueue[data.request_guid] || this._advertisementRequestQueue[data.request_guid]) {
            return;
        }

        this._proxyAdvertisementRequestQueue[data.request_guid] = {
            timestamp: Date.now(),
            ws
        };

        this.propagateRequestAdvertisement(data, ws);

        const advertiserRepository = database.getRepository('advertiser');
        advertiserRepository.syncAdvertisementToConsumer(data.node_id)
                            .then(advertisements => {
                                console.log(`[peer] found ${advertisements.length} new advertisements to peer ${data.node_id}`);
                                if (advertisements.length === 0) {
                                    return;
                                }
                                advertisements.forEach(advertisement => {
                                    advertiserRepository.logAdvertisementRequest(advertisement.advertisement_guid,
                                        data.node_id,
                                        data.node_ip_address,
                                        data.request_guid,
                                        data.protocol_address_key_identifier,
                                        JSON.stringify(data)).then(_ => _);
                                });
                                const payload = {
                                    type   : 'advertisement_new',
                                    content: {
                                        node_id           : network.nodeID,
                                        node_ip_address   : network.nodePublicIp,
                                        node_port         : config.NODE_PORT,
                                        request_guid      : data.request_guid,
                                        advertisement_list: advertisements
                                    }
                                };
                                ws.send(JSON.stringify(payload));
                            });
    }

    notifyNewPeer(ws) {
        const payload = {
            type   : 'new_peer',
            content: {
                node_id     : ws.nodeID,
                node_prefix : ws.nodePrefix,
                node_address: ws.nodeIPAddress,
                node_port   : ws.nodePort
            }
        };
        const data    = JSON.stringify(payload);
        network.registeredClients.forEach(ws => {
            try {
                ws.send(data);
            }
            catch (e) {
                console.log('[WARN]: try to send data over a closed connection.');
                ws && ws.close();
                network._unregisterWebsocket(ws);
            }
        });
    }

    requestAdvertisement() {
        const requestID                            = Database.generateID(32);
        this._advertisementRequestQueue[requestID] = {
            timestamp: Date.now()
        };
        const payload                              = {
            type   : 'advertisement_request',
            content: {
                node_id                        : network.nodeID,
                node_ip_address                : network.nodePublicIp,
                protocol_address_key_identifier: this.protocolAddressKeyIdentifier,
                request_guid                   : requestID,
                advertisement                  : {
                    type: 'all'
                }
            }
        };
        const data                                 = JSON.stringify(payload);

        network.registeredClients.forEach(ws => {
            try {
                ws.send(data);
            }
            catch (e) {
                console.log('[WARN]: try to send data over a closed connection.');
                ws && ws.close();
                network._unregisterWebsocket(ws);
            }
        });
    }

    propagateRequestAdvertisement(content, excludeWS) {
        const payload = {
            type: 'advertisement_request',
            content
        };
        const data    = JSON.stringify(payload);

        network.registeredClients.forEach(ws => {
            try {
                if (ws === excludeWS) {
                    return;
                }
                ws.send(data);
            }
            catch (e) {
                console.log('[WARN]: try to send data over a closed connection.');
                ws && ws.close();
                network._unregisterWebsocket(ws);
            }
        });
    }

    initialize() {
        //in
        eventBus.on('new_peer', this._onNewPeer.bind(this));
        eventBus.on('advertisement_request', this._onAdvertisementRequest.bind(this));
        eventBus.on('advertisement_new', this._onNewAdvertisement.bind(this));
        //out
        eventBus.on('peer_connection', (ws) => this.notifyNewPeer(ws));
        task.scheduleTask('peer-request-advertisement', () => this.requestAdvertisement(), 10000);
        const walletRepository   = database.getRepository('wallet');
        const keychainRepository = database.getRepository('keychain');
        return walletRepository.getWallet()
                               .then(wallet => keychainRepository.getWalletDefaultKeyIdentifier(wallet.wallet_id))
                               .then(addressKeyIdentified => {
                                   this.protocolAddressKeyIdentifier = addressKeyIdentified;
                               });
    }

    stop() {
        eventBus.removeAllListeners('new_peer');
        eventBus.removeAllListeners('advertisement_request');
        eventBus.removeAllListeners('peer_connection');
        task.removeTask('peer-request-advertisement');
    }
}


export default new Peer();
