import eventBus from '../core/event-bus';
import network from './network';
import database, {Database} from '../database/database';
import task from '../core/task';
import config from '../config/config';
import async from 'async';
import mutex from '../core/mutex';
import client from '../api/client';
import cache from '../core/cache';
import Utils from '../core/utils';
import _ from 'lodash';


export class Peer {
    constructor() {
        this._proxyAdvertisementRequestQueue    = {};
        this._proxyAdvertisementSyncQueue       = {};
        this._advertisementPaymentRequestQueue  = {};
        this._advertisementPaymentResponseQueue = {};
        this._advertisementRequestQueue         = {};
        this._advertisementSyncQueue            = {};
        this.protocolAddressKeyIdentifier       = null;
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
            if (advertisement.bid_impression_mlx < config.ADS_TRANSACTION_AMOUNT_MIN) {
                return callback();
            }
            consumerRepository.addAdvertisement(advertisement, nodeID, nodeIPAddress, nodePort, requestGUID)
                              .then(() => callback())
                              .catch(() => callback());
        });
    }

    _onSyncAdvertisement(data) {
        if (this._proxyAdvertisementSyncQueue[data.request_guid]) {
            const ws      = this._proxyAdvertisementSyncQueue[data.request_guid].ws;
            const payload = {
                type   : 'advertisement_sync',
                content: data
            };
            ws.send(JSON.stringify(payload));
            return;
        }
        else if (!this._advertisementSyncQueue[data.request_guid]) {
            return;
        }

        const {
                  advertisement_list: advertisements,
                  node_id           : nodeID,
                  node_ip_address   : nodeIPAddress,
                  node_port         : nodePort
              } = data;
        console.log(`[peer] new advertisements ${JSON.stringify(advertisements, null, 4)}`);
        const consumerRepository = database.getRepository('consumer');
        async.eachSeries(advertisements, (advertisement, callback) => {
            if (advertisement.bid_impression_mlx < config.ADS_TRANSACTION_AMOUNT_MIN) {
                return callback();
            }
            consumerRepository.addAdvertisement(advertisement, nodeID, nodeIPAddress, nodePort, advertisement.advertisement_request_guid)
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

    _onAdvertisementSyncRequest(data, ws) {
        if (this._proxyAdvertisementSyncQueue[data.request_guid] || this._advertisementSyncQueue[data.request_guid]) {
            return;
        }

        this._proxyAdvertisementSyncQueue[data.request_guid] = {
            timestamp: Date.now(),
            ws
        };

        this.propagateRequest('advertisement_sync_request', data, ws);

        const advertiserRepository = database.getRepository('advertiser');
        advertiserRepository.listConsumerActiveAdvertisement(data.node_id)
                            .then(advertisements => {
                                console.log(`[peer] found ${advertisements.length} sync advertisements to peer ${data.node_id}`);
                                if (advertisements.length === 0) {
                                    return;
                                }

                                const payload = {
                                    type   : 'advertisement_sync',
                                    content: {
                                        node_id           : this.nodeID,
                                        node_ip_address   : network.nodePublicIp,
                                        node_port         : config.NODE_PORT,
                                        request_guid      : data.request_guid,
                                        advertisement_list: advertisements
                                    }
                                };
                                ws.send(JSON.stringify(payload));
                            });
    }

    _onAdvertisementRequest(data, ws) {
        if (this._proxyAdvertisementRequestQueue[data.request_guid] || this._advertisementRequestQueue[data.request_guid] ||
            !data.protocol_address_key_identifier ||
            config.MODE_TEST === false && !data.protocol_address_key_identifier.startsWith('1') ||
            config.MODE_TEST === true && data.protocol_address_key_identifier.startsWith('1')) {
            return;
        }

        this._proxyAdvertisementRequestQueue[data.request_guid] = {
            timestamp: Date.now(),
            ws
        };

        this.propagateRequest('advertisement_request', data, ws);

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
                                        node_id           : this.nodeID,
                                        node_ip_address   : network.nodePublicIp,
                                        node_port         : config.NODE_PORT,
                                        request_guid      : data.request_guid,
                                        advertisement_list: advertisements
                                    }
                                };
                                ws.send(JSON.stringify(payload));
                            });
    }

    sendPeerList(ws) {
        for (let peerWS of network.registeredClients) {
            const payload = {
                type   : 'new_peer',
                content: {
                    node_id     : peerWS.nodeID,
                    node_prefix : peerWS.nodePrefix,
                    node_address: peerWS.nodeIPAddress,
                    node_port   : peerWS.nodePort
                }
            };
            try {
                const data = JSON.stringify(payload);
                ws.send(data);
            }
            catch (e) {
                console.log('[WARN]: try to send data over a closed connection.');
                ws && ws.close();
                network._unregisterWebsocket(ws);
                return;
            }
        }
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
            const key = `peer_notify_${ws.nodeID}_${payload.content.node_id}`;
            if (cache.getCacheItem('peer', key)) {
                return;
            }
            cache.setCacheItem('peer', key, true, Number.MAX_SAFE_INTEGER);
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

    // sync active advertisement to the current consumer
    requestAdvertisementSync() {
        const requestID                         = Database.generateID(32);
        this._advertisementSyncQueue[requestID] = {
            timestamp: Date.now()
        };
        const payload                           = {
            type   : 'advertisement_sync_request',
            content: {
                node_id     : this.nodeID,
                request_guid: requestID
            }
        };
        const data                              = JSON.stringify(payload);

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
                node_id                        : this.nodeID,
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

    propagateRequest(type, content, excludeWS) {
        const payload = {
            type,
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

    _onAdvertisementPaymentRequest(data, ws) {
        if (this._advertisementPaymentRequestQueue[data.message_guid]) {
            return;
        }

        this._advertisementPaymentRequestQueue[data.message_guid] = {timestamp: Date.now()};
        this.propagateRequest('advertisement_payment_request', data, ws);

        console.log(`[peer] payment request received from node ${ws.nodeID}:`, data);
        const advertiserRepository = database.getRepository('advertiser');
        advertiserRepository.getAdvertisementLedger({
            advertisement_guid        : data.advertisement_guid,
            advertisement_request_guid: data.request_guid
        })
                            .then(advertisementLedgerData => {

                                if (advertisementLedgerData) {
                                    const normalizationRepository = database.getRepository('normalization');
                                    const message                 = {
                                        'message_guid'           : Database.generateID(32),
                                        advertisement_ledger_list: [
                                            {
                                                'protocol_transaction_id' : _.find(advertisementLedgerData.attributes, {attribute_type_guid: normalizationRepository.get('protocol_transaction_id')}).value,
                                                'protocol_output_position': parseInt(_.find(advertisementLedgerData.attributes, {attribute_type_guid: normalizationRepository.get('protocol_output_position')}).value),
                                                'deposit'                 : advertisementLedgerData.withdrawal,
                                                ..._.pick(advertisementLedgerData, [
                                                    'advertisement_request_guid',
                                                    'advertisement_guid',
                                                    'tx_address_deposit_vout_md5',
                                                    'price_usd'
                                                ])
                                            }
                                        ]
                                    };

                                    this._advertisementPaymentResponseQueue[message.message_guid] = {
                                        timestamp: Date.now()
                                    };
                                    this.propagateRequest('advertisement_payment_response', message);
                                    return;
                                }

                                return advertiserRepository.getAdvertisementIfPaymentNotFound(data.advertisement_guid, data.request_guid)
                                                           .then(advertisement => {
                                                               if (!advertisement) {
                                                                   console.log(`[peer] cannot create payment for ${data.advertisement_guid}:${data.request_guid}`);
                                                                   return;
                                                               }
                                                               console.log(`[peer] advertisement data for pending payment`, advertisement);
                                                               console.log(`[peer] add pending payment to request ${data.request_guid}`);
                                                               return advertiserRepository.addAdvertisementPayment(data.advertisement_guid, data.request_guid, Math.min(config.ADS_TRANSACTION_AMOUNT_MAX, advertisement.bid_impression_mlx), 'withdrawal:external')
                                                                                          .then(advertisementLedgerData => console.log(`[peer] advertisement ledger record created`, advertisementLedgerData));
                                                           });
                            });
    }

    _onAdvertisementPaymentResponse(data, ws) {
        if (this._advertisementPaymentRequestQueue[data.message_guid]) {
            return;
        }

        this._advertisementPaymentRequestQueue[data.message_guid] = {timestamp: Date.now()};
        this.propagateRequest('advertisement_payment_response', data, ws);

        mutex.lock(['payment_response'], unlock => {
            const consumerRepository = database.getRepository('consumer');
            async.eachSeries(data.advertisement_ledger_list, (paymentData, callback) => {
                consumerRepository.listAdvertisement({
                    protocol_transaction_id: null,
                    creative_request_guid  : paymentData.advertisement_request_guid
                }).then(advertisement => {
                    console.log(`[peer] new payment received for ads display request ${advertisement.advertisement_request_guid}`, data);
                    return consumerRepository.addAdvertisementPaymentSettlement(paymentData);
                }).then(() => callback()).catch(() => callback());
            }, () => unlock());
        });
    }

    requestAdvertisementPayment(queueID) {
        const consumerRepository = database.getRepository('consumer');
        consumerRepository.getAdvertisement({
            queue_id               : queueID,
            protocol_transaction_id: null
        }).then(advertisement => {
            if (advertisement) {
                console.log(`[peer] advertisement without payment:`, advertisement);
                const payload = {
                    type   : 'advertisement_payment_request',
                    content: {
                        ..._.mapKeys(_.pick(advertisement, [
                            'advertisement_guid',
                            'creative_request_guid'
                        ]), (_, k) => k === 'creative_request_guid' ? 'request_guid' : k),
                        message_guid: Database.generateID(32)
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
        });
    }

    processAdvertisementPayment() {
        mutex.lock(['payment'], unlock => {
            console.log(`[peer] processing advertisement payments`);
            let maxOutputReached       = false;
            const advertiserRepository = database.getRepository('advertiser');
            advertiserRepository.listAdvertisementLedgerMissingPayment(config.TRANSACTION_OUTPUT_MAX - 1) // max - 1 (output allocated to fee)
                                .then(pendingPaymentList => {
                                    maxOutputReached = pendingPaymentList.length === config.TRANSACTION_OUTPUT_MAX - 1;
                                    return new Promise(resolve => {
                                        const ledgerGUIDKeyIdentifier = {};
                                        async.eachSeries(pendingPaymentList, (pendingPayment, callback) => {
                                            if (!pendingPayment) {
                                                return callback();
                                            }
                                            console.log(`[peer] processing payment for `, pendingPayment);
                                            advertiserRepository.getAdvertisementRequestLog({
                                                advertisement_guid        : pendingPayment.advertisement_guid,
                                                advertisement_request_guid: pendingPayment.advertisement_request_guid
                                            })
                                                                .then(requestLog => {
                                                                    if (config.MODE_TEST === false && requestLog.protocol_address_key_identifier && requestLog.protocol_address_key_identifier.startsWith('1')) {
                                                                        ledgerGUIDKeyIdentifier[pendingPayment.ledger_guid] = requestLog.protocol_address_key_identifier;
                                                                    }
                                                                    else if (config.MODE_TEST === true && requestLog.protocol_address_key_identifier && !requestLog.protocol_address_key_identifier.startsWith('1')) {
                                                                        ledgerGUIDKeyIdentifier[pendingPayment.ledger_guid] = requestLog.protocol_address_key_identifier;
                                                                    }
                                                                    callback();
                                                                }).catch(() => callback());
                                        }, () => {
                                            resolve(pendingPaymentList.filter(pendingPayment => !!ledgerGUIDKeyIdentifier[pendingPayment.ledger_guid]) // filter ledger guid with known key identifier
                                                                      .map((pendingPayment) => ({
                                                                          advertisement_ledger: pendingPayment,
                                                                          output              : {
                                                                              address_base          : ledgerGUIDKeyIdentifier[pendingPayment.ledger_guid],
                                                                              address_version       : config.TRANSACTION_ADDRESS_VERSION,
                                                                              address_key_identifier: ledgerGUIDKeyIdentifier[pendingPayment.ledger_guid],
                                                                              amount                : Math.min(config.ADS_TRANSACTION_AMOUNT_MAX, pendingPayment.withdrawal)
                                                                          }
                                                                      })));
                                        });
                                    });
                                })
                                .then(advertisementLedgerOutputList => {
                                    if (advertisementLedgerOutputList.length === 0) {
                                        return Promise.reject('no_pending_payment_found');
                                    }

                                    console.log(`[peer] transaction output`, advertisementLedgerOutputList);
                                    const outputList = _.map(advertisementLedgerOutputList, advertisementLedgerOutput => advertisementLedgerOutput.output);

                                    return client.sendTransaction({
                                        'transaction_output_list': outputList,
                                        'transaction_output_fee' : {
                                            'fee_type': 'transaction_fee_default',
                                            'amount'  : config.TRANSACTION_PROXY_FEE
                                        }
                                    }).then(data => {
                                        console.log('[peer] payment done:', data);
                                        if (data.api_status !== 'success') {
                                            return Promise.reject(data.api_message);
                                        }
                                        const transaction = data.transaction[data.transaction.length - 1];
                                        return advertiserRepository.updateAdvertisementLedgerWithPayment(transaction, advertisementLedgerOutputList);
                                    });
                                })
                                .then(data => {
                                    const message = {
                                        message_guid             : Database.generateID(32),
                                        advertisement_ledger_list: data
                                    };

                                    this._advertisementPaymentResponseQueue[data.message_guid] = {
                                        timestamp: Date.now()
                                    };
                                    this.propagateRequest('advertisement_payment_response', message);
                                })
                                .then(() => {
                                    unlock();
                                    if (maxOutputReached) {
                                        setTimeout(() => this.processAdvertisementPayment(), 10000);
                                    }
                                })
                                .catch(err => {
                                    console.log(`[peer] error processing payments:`, err);
                                    unlock();
                                });
        });
    }

    pruneAdvertisementQueue() {
        console.log('[peer] prune advertisement queue from consumer database');
        let pruneOlderThanTimestamp = Math.floor(Date.now() / 1000 - config.ADS_PRUNE_AGE); // 1 days old
        const consumerRepository    = database.getRepository('consumer');
        consumerRepository.pruneAdvertisementQueue(pruneOlderThanTimestamp);

        pruneOlderThanTimestamp = Math.floor(Date.now() / 1000 - 600); // 10 min
        return consumerRepository.pruneAdvertisementRequestWithNoPaymentRequestQueue(pruneOlderThanTimestamp);
    }

    pruneAdvertisementRequestWithNoPaymentRequestQueue() {
        console.log('[peer] prune active advertisement request with no payment request in the last 24h');
        const pruneOlderThanTimestamp = Math.floor(Date.now() / 1000 - 86400);
        const advertiserRepository    = database.getRepository('advertiser');
        return advertiserRepository.pruneAdvertisementRequestWithNoPaymentRequestQueue(pruneOlderThanTimestamp);
    }

    initialize() {
        //in
        eventBus.on('new_peer', this._onNewPeer.bind(this));
        eventBus.on('advertisement_request', this._onAdvertisementRequest.bind(this));
        eventBus.on('advertisement_sync_request', this._onAdvertisementSyncRequest.bind(this));
        eventBus.on('advertisement_payment_request', this._onAdvertisementPaymentRequest.bind(this));
        eventBus.on('advertisement_payment_response', this._onAdvertisementPaymentResponse.bind(this));
        eventBus.on('advertisement_new', this._onNewAdvertisement.bind(this));
        eventBus.on('advertisement_sync', this._onSyncAdvertisement.bind(this));

        //out
        eventBus.on('peer_connection', (ws) => {
            this.sendPeerList(ws);
            this.notifyNewPeer(ws);
        });
        task.scheduleTask('peer-request-advertisement-once-on-boot', () => this.requestAdvertisement(), 15000, false, true);
        task.scheduleTask('peer-request-advertisement', () => this.requestAdvertisement(), 60000);
        task.scheduleTask('peer-sync-advertisement', () => this.requestAdvertisementSync(), 600000);
        task.scheduleTask('advertisement-payment-process', () => this.processAdvertisementPayment(), 60000);
        task.scheduleTask('advertisement-queue-prune', () => this.pruneAdvertisementQueue(), 60000);
        task.scheduleTask('advertisement-request-no-payment-request-prune', () => this.pruneAdvertisementRequestWithNoPaymentRequestQueue(), 60000);
        return Utils.loadNodeKeyAndCertificate()
                    .then(({
                               node_id       : nodeID,
                               node_signature: nodeSignature
                           }) => {
                        this.nodeID = nodeID;
                        client.loadCredentials(nodeID, nodeSignature);
                        return client.getWalletInformation()
                                     .then(data => {
                                         if (data.api_status === 'success') {
                                             this.protocolAddressKeyIdentifier = data.wallet.address_key_identifier;
                                         }
                                         else {
                                             return Promise.reject(data);
                                         }
                                     });
                    });
    }

    stop() {
        eventBus.removeAllListeners('new_peer');
        eventBus.removeAllListeners('advertisement_request');
        eventBus.removeAllListeners('advertisement_sync');
        eventBus.removeAllListeners('advertisement_payment_request');
        eventBus.removeAllListeners('advertisement_payment_response');
        eventBus.removeAllListeners('peer_connection');
        task.removeTask('peer-request-advertisement-once-on-boot');
        task.removeTask('peer-request-advertisement');
        task.removeTask('peer-sync-advertisement');
        task.removeTask('advertisement-payment-process');
        task.removeTask('advertisement-queue-prune');
        task.removeTask('advertisement-request-no-payment-request-prune');
    }
}


export default new Peer();
