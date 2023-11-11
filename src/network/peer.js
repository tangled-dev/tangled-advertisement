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
import {machineId} from 'node-machine-id';
import request from 'request';
import ntp from '../core/ntp';
import utils from '../core/utils';


export class Peer {
    constructor() {
        this._proxyAdvertisementRequestQueue        = {};
        this._proxyAdvertisementSyncQueue           = {};
        this._proxyAdvertisementPaymentRequestQueue = {};
        this._advertisementPaymentRequestQueue      = {};
        this._advertisementRequestQueue             = {};
        this._advertisementSyncQueue                = {};
        this._ipAddressesThrottled                  = new Set();
        this._ipAddressesValidation                 = {};
        this._messageQueue                          = {};
        this._deviceMessageQueue                    = {};
        this.protocolAddressKeyIdentifier           = null;
        this.paymentBacklogSize                     = 0;
        this.isProcessingPayment                    = false;
        this.stats                                  = {
            'advertisement_request'            : 0,
            'advertisement_request_sync'       : 0,
            'advertisement_payment_request'    : 0,
            'advertisement_payment_response'   : 0,
            'creative_request_not_found'       : 0,
            'advertisement_not_found'          : 0,
            'advertisement_payment_created'    : 0,
            'advertisement_payment_resend'     : 0,
            'advertisement_payment_not_created': 0
        };
    }

    _pruneMessageQueue(queue) {
        const objectsToRemove = [];
        _.each(queue, (value, key) => {
            if (value?.timestamp < ntp.now() - (value?.ttl || 30000)) {
                objectsToRemove.push(key);
            }
        });
        if (objectsToRemove.length === 0) {
            return;
        }
        if (Array.isArray(queue)) {
            _.pullAt(queue, objectsToRemove);
        }
        else {
            objectsToRemove.forEach(key => delete queue[key]);
        }
    }

    clearMessageQueues() {
        this._pruneMessageQueue(this._proxyAdvertisementRequestQueue);
        this._pruneMessageQueue(this._proxyAdvertisementSyncQueue);
        this._pruneMessageQueue(this._proxyAdvertisementPaymentRequestQueue);
        this._pruneMessageQueue(this._advertisementPaymentRequestQueue);
        this._pruneMessageQueue(this._advertisementRequestQueue);
        this._pruneMessageQueue(this._messageQueue);
        this._pruneMessageQueue(this._advertisementSyncQueue);
        _.forEach(this._deviceMessageQueue, message => this._pruneMessageQueue(message));
    }

    addDeviceMessage(deviceID, messageGUID, ttl = 60000) {
        if (!this._deviceMessageQueue[deviceID]) {
            this._deviceMessageQueue[deviceID] = [];
        }
        this._deviceMessageQueue[deviceID].push({
            message_guid: messageGUID,
            timestamp   : ntp.now(),
            ttl
        });
    }

    _onAdvertisementNetworkSyncAdvertisement(data) {
        if (this.shouldBlockMessage(data)) {
            return;
        }

        this._messageQueue[data.message_guid] = {
            timestamp: ntp.now()
        };

        if (this._advertisementRequestQueue[data.request_guid]) {
            const {
                      network_advertisement_list: networkAdvertisementList,
                      node_id                   : nodeID
                  } = data;
            console.log(`[peer] advertisement network >> new advertisements ${JSON.stringify(networkAdvertisementList, null, 4)}`);
            async.eachSeries(networkAdvertisementList, (networkAdvertisement, callback0) => {
                const advertisements           = networkAdvertisement.advertisement_list;
                const protocolTransactionID    = networkAdvertisement.protocol_transaction_id;
                const protocolAddressHash      = networkAdvertisement.protocol_address_hash;
                const protocolOutputPosition   = networkAdvertisement.protocol_output_position;
                const deposit                  = networkAdvertisement.deposit;
                const priceUSD                 = networkAdvertisement.price_usd;
                const advertisementRequestGUID = networkAdvertisement.advertisement_request_guid;

                const consumerRepository = database.getRepository('consumer');
                consumerRepository.addAdvertisementLedger(advertisementRequestGUID, protocolAddressHash, protocolTransactionID, protocolOutputPosition, deposit, priceUSD)
                                  .then(ledgerEntry => {
                                      async.eachSeries(advertisements, (advertisement, callback1) => {
                                          if (advertisement.bid_impression_mlx < config.ADS_TRANSACTION_AMOUNT_MIN) {
                                              return callback1();
                                          }
                                          return consumerRepository.addAdvertisementNetworkAdvertisement(advertisement, ledgerEntry.ledger_guid, nodeID, advertisementRequestGUID)
                                                                   .then(() => callback1())
                                                                   .catch((e) => {
                                                                       console.error(e);
                                                                       callback1();
                                                                   });
                                      });
                                  })
                                  .then(() => callback0())
                                  .catch((e) => {
                                      console.error(e);
                                      callback0();
                                  });
            });

        }
        else if (this._proxyAdvertisementRequestQueue[data.request_guid]) {
            const ws      = this._proxyAdvertisementRequestQueue[data.request_guid].ws;
            const payload = {
                type   : 'advertisement_network:advertisement_sync',
                content: data
            };
            this._sendData(ws, payload);
        }
    }

    _onNewAdvertisement(data) {
        if (this.shouldBlockMessage(data)) {
            return;
        }

        this._messageQueue[data.message_guid] = {
            timestamp: ntp.now()
        };

        if (this._advertisementRequestQueue[data.request_guid]) {
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
        else if (this._proxyAdvertisementRequestQueue[data.request_guid]) {
            const ws      = this._proxyAdvertisementRequestQueue[data.request_guid].ws;
            const payload = {
                type   : 'advertisement_new',
                content: data
            };
            this._sendData(ws, payload);
        }
    }

    _onSyncAdvertisement(data) {
        if (this.shouldBlockMessage(data)) {
            return;
        }

        this._messageQueue[data.message_guid] = {
            timestamp: ntp.now()
        };

        if (this._advertisementSyncQueue[data.request_guid]) {
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
        else if (this._proxyAdvertisementSyncQueue[data.request_guid]) {
            const ws      = this._proxyAdvertisementSyncQueue[data.request_guid].ws;
            const payload = {
                type   : 'advertisement_sync',
                content: data
            };
            this._sendData(ws, payload);
        }
    }

    _onNewPeer(peer, ws) {
        eventBus.emit('tangled_event_log', {
            type   : 'new_peer',
            content: peer,
            from   : ws.node
        });

        network.addNode(peer.node_prefix, peer.node_address, peer.node_port, peer.node_id, true, peer.advertisementProvider);
    }

    _onAdvertisementSyncRequest(data, ws) {
        data.message_guid = data.request_guid;
        if (!data.node_id ||
            this._proxyAdvertisementSyncQueue[data.node_id] ||
            this.shouldBlockMessage(data)) {
            return;
        }

        const deviceMessageQueueID = `request_sync_${data.node_id}`;
        if (this._deviceMessageQueue[deviceMessageQueueID]?.length >= 1) {
            return;
        }

        this.addDeviceMessage(deviceMessageQueueID, data.message_guid);

        this.stats['advertisement_request_sync'] += 1;

        this._proxyAdvertisementSyncQueue[data.request_guid] = {
            timestamp: ntp.now(),
            ws
        };

        this._messageQueue[data.message_guid] = {
            timestamp: ntp.now()
        };

        this._proxyAdvertisementSyncQueue[data.node_id] = {
            timestamp: ntp.now()
        };


        this.propagateRequest('advertisement_sync_request', data, ws, true);

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
                                        message_guid      : Database.generateID(32),
                                        timestamp         : ntp.now(),
                                        advertisement_list: advertisements
                                    }
                                };
                                this._sendData(ws, payload);
                            });
    }

    _onAdvertisementRequest(data, ws) {
        data.message_guid = data.request_guid;
        if (this._ipAddressesThrottled.has(data.node_ip_address) ||
            !data.protocol_address_key_identifier ||
            !data.device_id ||
            this.shouldBlockMessage(data) ||
            config.MODE_TEST === false && !data.protocol_address_key_identifier.startsWith('1') ||
            config.MODE_TEST === true && data.protocol_address_key_identifier.startsWith('1')) {
            return;
        }

        const deviceMessageQueueID = `request_${data.device_id}`;
        if (this._deviceMessageQueue[deviceMessageQueueID]?.length >= 1) {
            return;
        }

        this.addDeviceMessage(deviceMessageQueueID, data.message_guid);

        this.stats['advertisement_request'] += 1;

        this._proxyAdvertisementRequestQueue[data.request_guid] = {
            timestamp: ntp.now(),
            ws
        };

        this._messageQueue[data.message_guid] = {
            timestamp: ntp.now()
        };

        this.propagateRequest('advertisement_request', data, ws, true);

        const advertiserRepository = database.getRepository('advertiser');
        advertiserRepository.syncAdvertisementToConsumer(data.node_id, data.device_id)
                            .then(advertisements => advertisements.length > 0 ?
                                                    advertiserRepository.getAdvertisementCountByIpAddress(data.node_ip_address)
                                                                        .then(adCount => [
                                                                            advertisements,
                                                                            adCount
                                                                        ]) : [advertisements])
                            .then(([advertisements, adCount]) => {
                                let isValidIP = this._ipAddressesValidation[data.node_ip_address];
                                if (!_.isUndefined(isValidIP)) {
                                    return Promise.resolve([
                                        advertisements,
                                        adCount,
                                        isValidIP
                                    ]);
                                }
                                // check ip address
                                return new Promise((resolve => {
                                    if (advertisements.length === 0) { // no need to check ip if there is no ad to serve
                                        return resolve([advertisements]);
                                    }

                                    request.get(
                                        `${config.EXTERNAL_API_IP_CHECK}?p1=${data.node_ip_address}&p2=${data.protocol_address_key_identifier}`,
                                        (error, response, body) => {
                                            if (!error && response.statusCode === 200) {
                                                try {
                                                    const data                                        = JSON.parse(body);
                                                    const isValid                                     = !!data.is_valid;
                                                    this._ipAddressesValidation[data.node_ip_address] = isValid;
                                                    return resolve([
                                                        advertisements,
                                                        adCount,
                                                        isValid
                                                    ]);
                                                }
                                                catch (e) {
                                                    console.log('[peer] error', e);
                                                }
                                            }

                                            resolve([
                                                advertisements,
                                                adCount,
                                                true
                                            ]);

                                        }
                                    );
                                }));
                            })
                            .then(([advertisements, adCount, validNodeIpAddress]) => {
                                if (advertisements.length === 0 || adCount >= config.ADS_TRANSACTION_IP_MAX || !validNodeIpAddress) {
                                    return;
                                }

                                console.log(`[peer] found ${advertisements.length} new advertisements to peer ${data.node_id}`);

                                if (adCount === (config.ADS_TRANSACTION_IP_MAX - 1)) {
                                    this._ipAddressesThrottled.add(data.node_ip_address);
                                }

                                advertisements.forEach(advertisement => {
                                    advertiserRepository.logAdvertisementRequest(advertisement.advertisement_guid,
                                        data.device_id,
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
                                        message_guid      : Database.generateID(32),
                                        timestamp         : ntp.now(),
                                        advertisement_list: advertisements
                                    }
                                };
                                this._sendData(ws, payload);
                            });
    }

    _onAdvertisementNetworkAdvertisementRequest(data, ws) {
        data.message_guid = data.request_guid;
        if (this._ipAddressesThrottled.has(data.node_ip_address) ||
            !data.protocol_address_key_identifier ||
            !data.device_id ||
            this.shouldBlockMessage(data) ||
            config.MODE_TEST === false && !data.protocol_address_key_identifier.startsWith('1') ||
            config.MODE_TEST === true && data.protocol_address_key_identifier.startsWith('1')) {
            return;
        }

        const deviceMessageQueueID = `advertisement_network_request_${data.device_id}`;
        if (this._deviceMessageQueue[deviceMessageQueueID]?.length >= 1) {
            return;
        }

        this.addDeviceMessage(deviceMessageQueueID, data.message_guid);

        this.stats['advertisement_network:advertisement_request'] += 1;

        this._proxyAdvertisementRequestQueue[data.request_guid] = {
            timestamp: ntp.now(),
            ws
        };

        this._messageQueue[data.message_guid] = {
            timestamp: ntp.now()
        };

        this.propagateRequest('advertisement_network:advertisement_request', data, ws, true);

        if (data.advertisement?.advertisement_network_publisher?.includes(this.nodeID)) {
            const advertiserRepository = database.getRepository('advertiser');
            advertiserRepository.getAdvertisementNetwork({
                network_guid: data.node_id,
                status      : 1
            }).then(advertisementNetwork => {
                if (advertisementNetwork) {
                    // check if there is available balance
                    return advertiserRepository.listAdvertisementNetworkRequest({
                        network_guid                              : advertisementNetwork.network_guid,
                        'advertisement_network_request_log.status': 1
                    }).then(advertisementRequestList => {
                        const usedBudget    = advertisementRequestList.reduce((total, advertisementRequest) => total + advertisementRequest.bid_impression_mlx * advertisementRequest.count_impression, 0);
                        let availableBudget = advertisementNetwork.budget_daily_mlx - usedBudget;
                        if (availableBudget >= 50000) {
                            /* get advertisements for ad network */
                            const expiration = Math.floor(ntp.now() / 1000) + 86400; //1 day
                            return advertiserRepository
                                .listAdvertisement({status: 1})
                                .then(advertisementList => {
                                    advertisementList                = _.sortBy(advertisementList, ['bid_impression_mlx']);
                                    const newAdvertisementRequestMap = {};
                                    while (availableBudget > 0) {
                                        let hasNewAdvertisementImpression = false;
                                        for (const advertisement of advertisementList) {
                                            if (availableBudget > advertisement.bid_impression_mlx) {
                                                availableBudget -= advertisement.bid_impression_mlx;
                                                let newAdvertisementRequest = newAdvertisementRequestMap[advertisement.advertisement_guid];
                                                if (!newAdvertisementRequest) {
                                                    newAdvertisementRequest = {
                                                        publisher_guid            : this.nodeID,
                                                        advertisement_request_guid: data.request_guid,
                                                        advertisement_guid        : advertisement.advertisement_guid,
                                                        advertisement_url         : advertisement.advertisement_url,
                                                        bid_impression_mlx        : advertisement.bid_impression_mlx,
                                                        count_impression          : 0,
                                                        ledger_guid               : undefined,
                                                        protocol_transaction_id   : undefined,
                                                        protocol_output_position  : undefined,
                                                        expiration
                                                    };

                                                    newAdvertisementRequestMap[advertisement.advertisement_guid] = newAdvertisementRequest;
                                                }
                                                newAdvertisementRequest.count_impression++;
                                                hasNewAdvertisementImpression = true;
                                            }
                                            else {
                                                break;
                                            }
                                        }
                                        if (!hasNewAdvertisementImpression) {
                                            break;
                                        }
                                    }
                                    const newAdvertisementRequestList = Object.values(newAdvertisementRequestMap);
                                    if (newAdvertisementRequestList.length > 0) {
                                        const advertisementRequestRaw = JSON.stringify(data);
                                        const transactionAmount       = Math.min(config.ADS_TRANSACTION_AMOUNT_MAX, newAdvertisementRequestList.reduce((total, item) => total + item.bid_impression_mlx * item.count_impression, 0));
                                        const transactionAmountUSD    = (transactionAmount / config.MILLIX_USD_VALUE).toFixed(2);

                                        const {
                                                  address,
                                                  identifier
                                              } = utils.getAddressComponent(advertisementNetwork.protocol_address_hash);

                                        if (!address) {
                                            throw Error(`Invalid address (${advertisementNetwork.protocol_address_hash} for advertisement network ${advertisementNetwork.network_name}`);
                                        }

                                        const output = {
                                            address_base          : address,
                                            address_version       : config.TRANSACTION_ADDRESS_VERSION,
                                            address_key_identifier: identifier,
                                            amount                : transactionAmount
                                        };
                                        return advertiserRepository.addAdvertisementPayment(null, data.request_guid, transactionAmount, 'withdrawal:external')
                                                                   .then(advertisementLedger => {
                                                                       return client.sendTransaction({
                                                                           'transaction_output_list': [output],
                                                                           'transaction_output_fee' : {
                                                                               'fee_type': 'transaction_fee_default',
                                                                               'amount'  : config.TRANSACTION_PROXY_FEE
                                                                           }
                                                                       }).then(paymentData => {
                                                                           console.log('[peer] payment done:', paymentData);
                                                                           if (paymentData.api_status !== 'success') {
                                                                               return Promise.reject(data.api_message);
                                                                           }
                                                                           const transaction = paymentData.transaction[paymentData.transaction.length - 1];
                                                                           return advertiserRepository.updateAdvertisementLedgerWithPayment(transaction, [
                                                                               {
                                                                                   output,
                                                                                   advertisement_ledger: {
                                                                                       ledger_guid               : advertisementLedger.ledger_guid,
                                                                                       advertisement_request_guid: data.request_guid,
                                                                                       withdrawal                : transactionAmount,
                                                                                       price_usd                 : transactionAmountUSD
                                                                                   }
                                                                               }
                                                                           ]);
                                                                       }).then(() => {
                                                                           /* send payment and update advertisement network request log */
                                                                           const advertisementNetworkAdvertisementRequestLog = newAdvertisementRequestList.map(advertisementRequest => {
                                                                               return {
                                                                                   ledger_guid               : advertisementLedger.ledger_guid,
                                                                                   log_guid                  : Database.generateID(32),
                                                                                   advertisement_guid        : advertisementRequest.advertisement_guid,
                                                                                   advertisement_url         : advertisementRequest.advertisement_url,
                                                                                   advertisement_request_guid: advertisementRequest.advertisement_request_guid,
                                                                                   network_guid              : advertisementNetwork.network_guid,
                                                                                   network_guid_device       : data.device_id,
                                                                                   ip_address_device         : data.node_ip_address,
                                                                                   advertisement_request_raw : advertisementRequestRaw,
                                                                                   bid_impression_mlx        : advertisementRequest.bid_impression_mlx,
                                                                                   count_impression          : advertisementRequest.count_impression,
                                                                                   expiration
                                                                               };
                                                                           });
                                                                           return advertiserRepository.logAdvertisementNetworkAdvertisementRequestList(advertisementNetworkAdvertisementRequestLog)
                                                                                                      .then(() => advertisementRequestList.concat(...advertisementNetworkAdvertisementRequestLog));
                                                                       });
                                                                   });
                                    }

                                    /* return advertisements that should be propagated */
                                    return advertisementRequestList;
                                });
                        }

                        /* return advertisements that should be propagated */
                        return advertisementRequestList;

                    }).then(advertisementRequestList => {
                        // propagate list of active advertisement
                        if (advertisementRequestList && advertisementRequestList.length > 0) {
                            const networkAdvertisementLedgerMap = {};
                            const advertisementMap              = {};
                            advertisementRequestList.forEach(advertisementRequest => {
                                let ledgerEntry = networkAdvertisementLedgerMap[advertisementRequest.ledger_guid];
                                if (!ledgerEntry) {
                                    ledgerEntry                                                     = {
                                        advertisement_request_guid: advertisementRequest.advertisement_request_guid,
                                        advertisement_list        : []
                                    };
                                    networkAdvertisementLedgerMap[advertisementRequest.ledger_guid] = ledgerEntry;
                                }
                                const advertisement         = _.pick(advertisementRequest, [
                                    'advertisement_guid',
                                    'advertisement_url',
                                    'bid_impression_mlx',
                                    'count_impression',
                                    'expiration'
                                ]);
                                advertisement['attributes'] = [];

                                ledgerEntry.advertisement_list.push(advertisement);
                                advertisementMap[advertisement.advertisement_guid] = advertisement;
                            });

                            const normalizationRepository = database.getRepository('normalization');
                            return advertiserRepository.listAdvertisementLedgerByLedgerGUID(Object.keys(networkAdvertisementLedgerMap))
                                                       .then(ledgerItemList => {
                                                           ledgerItemList.forEach(row => {
                                                               networkAdvertisementLedgerMap[row.ledger_guid]['protocol_transaction_id']  = row.attributes.find(item => item.attribute_type_guid === normalizationRepository.get('protocol_transaction_id'))?.value;
                                                               networkAdvertisementLedgerMap[row.ledger_guid]['protocol_output_position'] = 0;
                                                               networkAdvertisementLedgerMap[row.ledger_guid]['protocol_address_hash']    = advertisementNetwork.protocol_address_hash;
                                                               networkAdvertisementLedgerMap[row.ledger_guid]['deposit']                  = row.withdrawal;
                                                               networkAdvertisementLedgerMap[row.ledger_guid]['price_usd']                = row.price_usd;
                                                           });
                                                           return advertiserRepository.getAdvertisementAttributes({advertisement_guid_in: advertisementRequestList.map(item => item.advertisement_guid)})
                                                                                      .then(attributeList => {
                                                                                          attributeList.forEach(row => {
                                                                                              advertisementMap[row.advertisement_guid].attributes.push(_.pick(row, [
                                                                                                  'advertisement_attribute_guid',
                                                                                                  'value',
                                                                                                  'attribute_type',
                                                                                                  'object'
                                                                                              ]));
                                                                                          });
                                                                                          console.log(`sending advertisements to advertisement network ${advertisementNetwork.network_name}`, advertisementRequestList);
                                                                                          const payload = {
                                                                                              type   : 'advertisement_network:advertisement_sync',
                                                                                              content: {
                                                                                                  node_id                   : this.nodeID,
                                                                                                  request_guid              : data.request_guid,
                                                                                                  message_guid              : Database.generateID(32),
                                                                                                  timestamp                 : ntp.now(),
                                                                                                  network_advertisement_list: Object.values(networkAdvertisementLedgerMap)
                                                                                              }
                                                                                          };
                                                                                          this._sendData(ws, payload);
                                                                                      });
                                                       });
                        }
                    });
                }
            }).catch(_ => _);
        }
    }

    _onPeerConnection(ws) {
        this.sendPeerList(ws);
        this.notifyNewPeer(ws);
    }

    _onPeerDisconnection(ws) {
        if (ws.connectionID && !network.getWebSocketByConnectionID(ws.connectionID)) {
            cache.removeCacheItem('peer', `peer_list_${ws.connectionID}`);
        }
    }

    sendPeerList(ws) {
        let cachedData = cache.getCacheItem('peer', `peer_list_${ws.connectionID}`);
        if (!cachedData) {
            cachedData = {};
        }

        for (let peerWS of network.registeredClients) {
            if (!peerWS.connectionID || !!cachedData[peerWS.connectionID]) {
                continue;
            }

            cachedData[peerWS.connectionID] = Date.now();

            const payload = {
                type   : 'new_peer',
                content: {
                    node_id               : peerWS.nodeID,
                    node_prefix           : peerWS.nodePrefix,
                    node_address          : peerWS.nodeIPAddress,
                    node_port             : peerWS.nodePort,
                    advertisement_provider: peerWS.advertisementProvider
                }
            };
            this._sendData(ws, payload);
        }

        cache.setCacheItem('peer', `peer_list_${ws.connectionID}`, cachedData, Number.MAX_SAFE_INTEGER);
    }

    notifyNewPeer(peerWS) {
        const payload = {
            type   : 'new_peer',
            content: {
                node_id               : peerWS.nodeID,
                node_prefix           : peerWS.nodePrefix,
                node_address          : peerWS.nodeIPAddress,
                node_port             : peerWS.nodePort,
                advertisement_provider: peerWS.advertisementProvider
            }
        };
        const data    = JSON.stringify(payload);
        network.registeredClients.forEach(ws => {
            if (!ws.connectionID) {
                return;
            }
            const cachedData = cache.getCacheItem('peer', `peer_list_${ws.connectionID}`);
            if (!cachedData) {
                return;
            }

            if (!!cachedData[peerWS.connectionID] && cachedData[peerWS.connectionID] > Date.now() - 600000) {
                return;
            }

            cachedData[peerWS.connectionID] = Date.now();

            this._sendData(ws, data);
        });
    }

    // sync active advertisement to the current consumer
    requestAdvertisementSync() {
        const requestID                         = Database.generateID(32);
        const cachedData                        = {
            timestamp: ntp.now()
        };
        this._advertisementSyncQueue[requestID] = cachedData;
        this._messageQueue[requestID]           = cachedData;
        const payload                           = {
            type   : 'advertisement_sync_request',
            content: {
                node_id     : this.nodeID,
                timestamp   : ntp.now(),
                request_guid: requestID
            }
        };
        const data                              = JSON.stringify(payload);

        network.registeredClients.forEach(ws => {
            this._sendData(ws, data);
        });
    }

    requestAdvertisement() {
        const requestID                            = Database.generateID(32);
        const cachedData                           = {
            timestamp: ntp.now()
        };
        this._advertisementRequestQueue[requestID] = cachedData;
        this._messageQueue[requestID]              = cachedData;
        const payload                              = {
            type   : 'advertisement_request',
            content: {
                node_id                        : this.nodeID,
                node_ip_address                : network.nodePublicIp,
                protocol_address_key_identifier: this.protocolAddressKeyIdentifier,
                device_id                      : this.deviceID,
                request_guid                   : requestID,
                timestamp                      : ntp.now(),
                advertisement                  : {
                    type: 'all'
                }
            }
        };
        const data                                 = JSON.stringify(payload);

        network.registeredClients.forEach(ws => {
            this._sendData(ws, data);
        });
    }

    advertisementNetworkCheckPayment() {
        const consumerRepository = database.getRepository('consumer');
        return consumerRepository.listAdvertisementNetworkQueue({
            payment_received_date: null,
            status               : 1
        }).then(activeAdvertisementNetworkPendingPaymentList => {
            const ledgerGUIDSet = new Set(activeAdvertisementNetworkPendingPaymentList.map(item => item.ledger_guid));
            return new Promise(resolve => {
                async.eachSeries(ledgerGUIDSet, (ledgerGUID, callback) => {
                    consumerRepository.getAdvertisementLedger({ledger_guid: ledgerGUID})
                                      .then(ledgerItem => {
                                          return client.listTransactionOutput(ledgerItem.protocol_transaction_id, ledgerItem.protocol_output_position)
                                                       .then(transactionOutput => {
                                                           if (transactionOutput.is_stable === 1 && transactionOutput.is_double_spend === 0 && transactionOutput.address === ledgerItem.protocol_address_hash &&
                                                               transactionOutput.amount === ledgerItem.deposit) {
                                                               ledgerItem.protocol_is_stable       = 1;
                                                               ledgerItem.protocol_is_double_spend = 0;
                                                               return [
                                                                   ledgerItem,
                                                                   transactionOutput
                                                               ];
                                                           }
                                                           return Promise.reject();
                                                       });
                                      })
                                      .then(([ledgerItem, transactionOutput]) => {
                                          return consumerRepository.updateLedger(ledgerItem, {ledger_guid: ledgerItem.ledger_guid})
                                                                   .then(() => {
                                                                       return consumerRepository.updateAdvertisementNetworkQueue({
                                                                           payment_received_date: transactionOutput.stable_date
                                                                       }, {ledger_guid: ledgerItem.ledger_guid});
                                                                   })
                                                                   .then(() => callback());
                                      })
                                      .catch(() => callback());
                }, () => resolve());
            });
        }).catch(_ => _);
    }

    advertisementNetworkRequestAdvertisement() {
        const consumerRepository = database.getRepository('consumer');
        consumerRepository.listAdvertisementNetworkPublisher({status: 1})
                          .then((advertisementNetworkPublisherList) => {
                              const advertisementNetworkPublisherIDs     = advertisementNetworkPublisherList.map(item => item.publisher_guid);
                              const requestID                            = Database.generateID(32);
                              const cachedData                           = {
                                  timestamp: ntp.now()
                              };
                              this._advertisementRequestQueue[requestID] = cachedData;
                              this._messageQueue[requestID]              = cachedData;
                              const payload                              = {
                                  type   : 'advertisement_network:advertisement_request',
                                  content: {
                                      node_id                        : this.nodeID,
                                      node_ip_address                : network.nodePublicIp,
                                      protocol_address_key_identifier: this.protocolAddressKeyIdentifier,
                                      device_id                      : this.deviceID,
                                      request_guid                   : requestID,
                                      timestamp                      : ntp.now(),
                                      advertisement                  : {
                                          advertisement_network_publisher: advertisementNetworkPublisherIDs,
                                          type                           : 'all'
                                      }
                                  }
                              };
                              const data                                 = JSON.stringify(payload);

                              network.registeredClients.forEach(ws => {
                                  this._sendData(ws, data);
                              });
                          }).catch(_ => _);
    }

    processWebmasterAdvertisementPayment() {
        const webmasterPaymentInfoMap = {};
        let outputList;
        const consumerRepository      = database.getRepository('consumer');
        return consumerRepository.listAdvertisementNetworkWebmasterQueue({
            ledger_guid: null,
            status     : 1
        }).then(webmasterRequestPendingPaymentList => {
            if (webmasterRequestPendingPaymentList.length === 0) {
                return;
            }

            webmasterRequestPendingPaymentList.forEach(item => {
                let webmasterPaymentInfo = webmasterPaymentInfoMap[item.webmaster_guid];
                if (!webmasterPaymentInfo) {
                    webmasterPaymentInfo                         = {
                        output         : {
                            amount: 0
                        },
                        queue_item_list: []
                    };
                    webmasterPaymentInfoMap[item.webmaster_guid] = webmasterPaymentInfo;
                }
                webmasterPaymentInfo.output.amount += item.bid_impression_mlx * item.count_impression;
                webmasterPaymentInfo.queue_item_list.push(item);
            });
            return consumerRepository.listAdvertisementNetworkWebmaster({
                webmaster_guid_in: Object.keys(webmasterPaymentInfoMap),
                status           : 1
            });
        }).then(webmasterList => {
            webmasterList.forEach(webmaster => {
                const {
                          address,
                          version,
                          identifier
                      } = utils.getAddressComponent(webmaster.protocol_address_hash);
                if (!address) {
                    delete webmasterPaymentInfoMap[webmaster.webmaster_guid];
                    return;
                }
                webmasterPaymentInfoMap[webmaster.webmaster_guid].output['address_base']           = address;
                webmasterPaymentInfoMap[webmaster.webmaster_guid].output['address_version']        = version;
                webmasterPaymentInfoMap[webmaster.webmaster_guid].output['address_key_identifier'] = identifier;
            });

            outputList = Object.values(webmasterPaymentInfoMap).map(webmasterPaymentInfo => webmasterPaymentInfo.output);
            if (outputList.length === 0) {
                return Promise.reject();
            }

            return client.sendTransaction({
                'transaction_output_list': outputList,
                'transaction_output_fee' : {
                    'fee_type': 'transaction_fee_default',
                    'amount'  : config.TRANSACTION_PROXY_FEE
                }
            });
        }).then(paymentData => {
            console.log('[peer] payment done:', paymentData);
            if (paymentData.api_status !== 'success') {
                return Promise.reject(paymentData.api_message);
            }
            const transaction   = paymentData.transaction[paymentData.transaction.length - 1];
            const transactionID = transaction.transaction_id;
            return new Promise((resolve) => {
                let outputPosition = 0;
                async.eachSeries(Object.values(webmasterPaymentInfoMap), (webmasterPaymentInfo, callback) => {
                    const output              = webmasterPaymentInfo.output;
                    const protocolAddressHash = `${output.address_base}${output.address_version}${output.address_key_identifier}`;
                    const amountUSD           = (output.amount / config.MILLIX_USD_VALUE).toFixed(2);
                    consumerRepository.addAdvertisementLedger(null, protocolAddressHash, transactionID, outputPosition, output.amount, amountUSD)
                                      .then(ledgerItem => {
                                          return consumerRepository.updateAdvertisementNetworkWebmasterQueue({ledger_guid: ledgerItem.ledger_guid}, {queue_guid_in: webmasterPaymentInfo.queue_item_list.map(item => item.queue_guid)});
                                      })
                                      .catch(e => {
                                          console.error(e);
                                      })
                                      .then(() => {
                                          outputPosition++;
                                          callback();
                                      });
                }, () => resolve());
            });
        }).catch(_ => _);
    }

    advertisementNetworkExpireRequestLog() {
        const advertiserRepository = database.getRepository('advertiser');
        const oneDayAgo            = Math.floor(ntp.now() / 1000);
        return advertiserRepository.updateAdvertisementNetworkRequest({status: 0}, {
            expiration_max: oneDayAgo,
            status        : 1
        }).catch(_ => _);
    }

    advertisementNetworkExpireWebmasterRequestLog() {
        const consumerRepository = database.getRepository('consumer');
        const oneDayAgo          = Math.floor(Date.now() / 1000) - 86400;
        return consumerRepository.updateAdvertisementNetworkWebmasterQueue({status: 0}, {
            create_date_max: oneDayAgo,
            status         : 1
        }).catch(_ => _);
    }


    propagateRequest(type, content, excludeWS, excludeNonAdvertisementProvider) {
        const payload = {
            type,
            content
        };
        const data    = JSON.stringify(payload);

        network.registeredClients.forEach(ws => {
            if (ws === excludeWS || excludeNonAdvertisementProvider && !ws.advertisementProvider) {
                return;
            }
            this._sendData(ws, data);
        });
    }

    _onAdvertisementPaymentRequest(data, ws) {
        const key                  = `${data.request_guid}_${data.advertisement_guid}`;
        const advertiserRepository = database.getRepository('advertiser');
        if (!data.advertisement_guid ||
            !data.request_guid ||
            this.shouldBlockMessage(data)) {
            return;
        }

        this._proxyAdvertisementPaymentRequestQueue[key] = {
            timestamp: ntp.now(),
            ws
        };

        this._messageQueue[data.message_guid] = {
            timestamp: ntp.now()
        };

        this.propagateRequest('advertisement_payment_request', data, ws, true);

        if (!advertiserRepository.getAdvertisementGUIDCached().has(data.advertisement_guid)) {
            return;
        }

        const deviceMessageQueueID = `payment_${data.device_id}`;
        if (this._deviceMessageQueue[deviceMessageQueueID]?.length >= 5) {
            return;
        }

        this.stats['advertisement_payment_request'] += 1;

        cache.getCachedIfPresent('advertiser', `advertisement_${data.advertisement_guid}`, () => advertiserRepository.getAdvertisement({
            advertisement_guid: data.advertisement_guid,
            status            : 1
        })).then(advertisement => {
            if (!advertisement) {
                return;
            }

            advertiserRepository.getAdvertisementRequestLog({
                advertisement_guid        : data.advertisement_guid,
                advertisement_request_guid: data.request_guid,
                status                    : 1
            }).then(advertisementRequest => {
                if (!advertisementRequest) {

                    advertiserRepository.getAdvertisementRequestLog({
                        advertisement_request_guid: data.request_guid,
                        status                    : 1
                    }).then(advertisementRequest => {
                        const error   = !advertisementRequest ? 'creative_request_not_found' : 'advertisement_not_found';
                        this.stats[error] += 1;
                        const message = {
                            message_guid      : Database.generateID(32),
                            advertisement_guid: data.advertisement_guid,
                            request_guid      : data.request_guid,
                            device_id         : data.device_id,
                            timestamp         : ntp.now(),
                            advertisement     : {
                                device_id: data.device_id
                            },
                            error
                        };

                        this.propagateRequest('advertisement_payment_response', message);
                    });
                    return;
                }

                return advertiserRepository.getAdvertisementLedger({
                    advertisement_guid        : data.advertisement_guid,
                    advertisement_request_guid: data.request_guid
                }).then(advertisementLedgerData => {

                    if (advertisementLedgerData) {
                        this.stats['advertisement_payment_resend'] += 1;
                        const normalizationRepository = database.getRepository('normalization');
                        const message                 = {
                            message_guid             : Database.generateID(32),
                            request_guid             : data.request_guid,
                            timestamp                : ntp.now(),
                            advertisement_guid       : data.advertisement_guid,
                            advertisement_ledger_list: [
                                {
                                    protocol_transaction_id : _.find(advertisementLedgerData.attributes, {attribute_type_guid: normalizationRepository.get('protocol_transaction_id')}).value,
                                    protocol_output_position: parseInt(_.find(advertisementLedgerData.attributes, {attribute_type_guid: normalizationRepository.get('protocol_output_position')}).value),
                                    deposit                 : advertisementLedgerData.withdrawal,
                                    ..._.pick(advertisementLedgerData, [
                                        'advertisement_request_guid',
                                        'advertisement_guid',
                                        'tx_address_deposit_vout_md5',
                                        'price_usd'
                                    ])
                                }
                            ]
                        };

                        this.propagateRequest('advertisement_payment_response', message);
                        this.addDeviceMessage(deviceMessageQueueID, data.message_guid);
                        return;
                    }

                    mutex.lock(['payment_add'], unlock => {
                        if (this.paymentBacklogSize >= config.ADS_PAYMENT_BACKLOG_MAX) {
                            return unlock();
                        }

                        return advertiserRepository.getAdvertisementIfPaymentNotFound(data.advertisement_guid, data.request_guid)
                                                   .then(advertisement => {
                                                       if (!advertisement) {
                                                           this.stats['advertisement_payment_not_created'] += 1;
                                                           console.log(`[peer] cannot create payment for ${data.advertisement_guid}:${data.request_guid}`);
                                                           return unlock();
                                                       }

                                                       this.stats['advertisement_payment_created'] += 1;
                                                       console.log(`[peer] advertisement data for pending payment`, advertisement);
                                                       console.log(`[peer] add pending payment to request ${data.request_guid}`);
                                                       return advertiserRepository.addAdvertisementPayment(data.advertisement_guid, data.request_guid, Math.min(config.ADS_TRANSACTION_AMOUNT_MAX, advertisement.bid_impression_mlx), 'withdrawal:external')
                                                                                  .then(advertisementLedgerData => {
                                                                                      this.paymentBacklogSize += 1;
                                                                                      if (this.paymentBacklogSize >= config.TRANSACTION_OUTPUT_MAX) {
                                                                                          this.processAdvertisementPayment();
                                                                                      }
                                                                                      console.log(`[peer] advertisement ledger record created`, advertisementLedgerData);
                                                                                      unlock();
                                                                                  });
                                                   }).catch(() => unlock());
                    });

                });
            });

        });
    }

    _onAdvertisementPaymentResponse(data) {
        const key = `${data.request_guid}_${data.advertisement_guid}`;

        if (this.shouldBlockMessage(data) ||
            !this._proxyAdvertisementPaymentRequestQueue[key] &&
            !this._advertisementPaymentRequestQueue[key]) {
            return;
        }

        this.stats['advertisement_payment_response'] += 1;

        this._messageQueue[data.message_guid] = {
            timestamp: ntp.now()
        };

        if (this._advertisementPaymentRequestQueue[key]) {
            if (data.error && data.device_id === this.deviceID) {
                const consumerRepository = database.getRepository('consumer');
                const where              = {
                    creative_request_guid: data.request_guid,
                    advertisement_guid   : data.advertisement_guid,
                    payment_received_date: null
                };
                if (data.error === 'creative_request_not_found') {
                    delete where['advertisement_guid'];
                }
                consumerRepository.deleteAdvertisement(where).then(_ => _);
                return;
            }

            this.processPaymentSettlementMessage(data);
        }
        else if (this._proxyAdvertisementPaymentRequestQueue[key]) {
            const ws      = this._proxyAdvertisementPaymentRequestQueue[key].ws;
            const payload = {
                type   : 'advertisement_payment_response',
                content: data
            };
            this._sendData(ws, payload);
        }
    }


    processPaymentSettlementMessage(data) {
        mutex.lock(['payment_response'], unlock => {
            const consumerRepository = database.getRepository('consumer');
            async.eachSeries(data.advertisement_ledger_list, (paymentData, callback) => {
                consumerRepository.getAdvertisement({
                    protocol_transaction_id: null,
                    creative_request_guid  : paymentData.advertisement_request_guid,
                    advertisement_guid     : paymentData.advertisement_guid
                }).then(advertisement => {
                    if (advertisement) {
                        console.log(`[peer] new payment received for ads display request ${advertisement.creative_request_guid}`, data);
                        return consumerRepository.addAdvertisementPaymentSettlement(paymentData);
                    }
                }).then(() => callback()).catch(() => callback());
            }, () => unlock());
        });
    }

    _onAdvertisementPaymentNew(data, ws) {
        if (this.shouldBlockMessage(data)) {
            return;
        }

        this._messageQueue[data.message_guid] = {
            timestamp: ntp.now()
        };

        this.propagateRequest('advertisement_payment_new', data, ws);
        this.processPaymentSettlementMessage(data);
    }

    processAdvertisementPayment() {

        if (this.isProcessingPayment) {
            return;
        }

        this.isProcessingPayment = true;
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
                                            advertisement_request_guid: pendingPayment.advertisement_request_guid,
                                            status                    : 1
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
                                    timestamp                : ntp.now(),
                                    advertisement_ledger_list: data
                                };

                                this.paymentBacklogSize -= data.length;

                                this.propagateRequest('advertisement_payment_new', message);
                            })
                            .then(() => {
                                this.isProcessingPayment = false;
                                if (maxOutputReached) {
                                    setTimeout(() => this.processAdvertisementPayment(), 10000);
                                }
                            })
                            .catch(err => {
                                this.isProcessingPayment = false;
                                console.log(`[peer] error processing payments:`, err);
                                setTimeout(() => this.processAdvertisementPayment(), 10000);
                            });
    }

    pruneConsumerAdvertisementQueue() {
        console.log('[peer] prune advertisement queue from consumer database');
        let pruneOlderThanTimestamp = Math.floor(Date.now() / 1000 - config.ADS_PRUNE_AGE); // 1 days old
        const consumerRepository    = database.getRepository('consumer');
        consumerRepository.pruneAdvertisementQueue(pruneOlderThanTimestamp).then(_ => _);

        console.log('[peer] prune consumer pending payment queue (2.5 minutes old)');
        pruneOlderThanTimestamp = Math.floor(Date.now() / 1000) - 150;
        return consumerRepository.resetAdvertisementPendingPayment(pruneOlderThanTimestamp);
    }

    pruneAdvertiserPendingPaymentQueue() {
        console.log('[peer] prune advertiser pending payment queue (2 minutes old)');
        const pruneOlderThanTimestamp = Math.floor(Date.now() / 1000) - 120;
        const advertiserRepository    = database.getRepository('advertiser');
        return advertiserRepository.pruneAdvertisementPendingPayment(pruneOlderThanTimestamp)
                                   .then(() => advertiserRepository.countPendingPayment())
                                   .then(pendingPaymentCount => this.paymentBacklogSize = pendingPaymentCount);
    }

    updateThrottledIpAddress() {
        const advertiserRepository = database.getRepository('advertiser');
        advertiserRepository.getThrottledIpAddresses(config.ADS_TRANSACTION_IP_MAX)
                            .then(throttledIpAddressList => {
                                this._ipAddressesThrottled.clear();
                                throttledIpAddressList.forEach(ipAddress => this._ipAddressesThrottled.add(ipAddress));
                            })
                            .catch(_ => _);
    }

    sendAdvertisementPaymentRequest(advertisement) {
        const payload = {
            type   : 'advertisement_payment_request',
            content: {
                ..._.mapKeys(_.pick(advertisement, [
                    'advertisement_guid',
                    'creative_request_guid'
                ]), (_, k) => k === 'creative_request_guid' ? 'request_guid' : k),
                device_id   : this.deviceID,
                timestamp   : ntp.now(),
                message_guid: Database.generateID(32)
            }
        };

        const cachedData = {
            timestamp: ntp.now()
        };

        this._advertisementPaymentRequestQueue[`${payload.content.request_guid}_${payload.content.advertisement_guid}`] = cachedData;

        this._messageQueue[payload.content.message_guid] = cachedData;

        const data = JSON.stringify(payload);
        network.registeredClients.forEach(ws => {
            this._sendData(ws, data);
        });
    }

    processAdvertisementQueue() {
        const consumerRepository = database.getRepository('consumer');
        // check if there is a pending payment
        return consumerRepository.listAdvertisement({
            'payment_request_date!': null,
            'payment_received_date': null
        }).then(pendingPaymentList => {
            console.log('[peer] current list of pending payment', pendingPaymentList);

            for (const advertisement of pendingPaymentList) {
                this.sendAdvertisementPaymentRequest(advertisement);
                console.log('[peer] advertisement request sent seconds ago ', Math.floor(Date.now() / 1000) - advertisement.payment_request_date);
            }

            if (pendingPaymentList.length <= 10) {
                // get a new random add to request payment from
                return consumerRepository.getRandomAdvertisementToRequestPayment()
                                         .then(advertisementCandidateList => {
                                             return new Promise(resolve => {
                                                 async.eachSeries(advertisementCandidateList, (advertisement, callback) => {
                                                     console.log('[peer] new advertisement being processed', advertisement);
                                                     this.sendAdvertisementPaymentRequest(advertisement);
                                                     // update advertisement.
                                                     // set payment requested
                                                     consumerRepository.update({
                                                         payment_request_date: Math.floor(Date.now() / 1000)
                                                     }, {
                                                         queue_id: advertisement.queue_id
                                                     }).then(() => callback()).catch(() => callback());
                                                 }, () => resolve());
                                             });
                                         });
            }
        });
    }

    shouldBlockMessage(data) {
        return !data.message_guid || this._messageQueue[data.message_guid] || !data.timestamp || data.timestamp < ntp.now() - 30000;
    }

    showStats() {
        this.stats['payment_backlog_size'] = this.paymentBacklogSize;
        console.log('[stats] current stats', this.stats);
    }

    initialize() {
        //in
        eventBus.on('new_peer', this._onNewPeer.bind(this));
        eventBus.on('advertisement_request', this._onAdvertisementRequest.bind(this));
        eventBus.on('advertisement_sync_request', this._onAdvertisementSyncRequest.bind(this));
        eventBus.on('advertisement_payment_request', this._onAdvertisementPaymentRequest.bind(this));
        eventBus.on('advertisement_payment_response', this._onAdvertisementPaymentResponse.bind(this));
        eventBus.on('advertisement_payment_new', this._onAdvertisementPaymentNew.bind(this));
        eventBus.on('advertisement_new', this._onNewAdvertisement.bind(this));
        eventBus.on('advertisement_sync', this._onSyncAdvertisement.bind(this));

        // ad network
        eventBus.on('advertisement_network:advertisement_request', this._onAdvertisementNetworkAdvertisementRequest.bind(this));
        eventBus.on('advertisement_network:advertisement_sync', this._onAdvertisementNetworkSyncAdvertisement.bind(this));

        //out
        eventBus.on('peer_connection', this._onPeerConnection.bind(this));

        //other
        eventBus.on('peer_connection_closed', this._onPeerDisconnection.bind(this));

        task.scheduleTask('peer-request-advertisement-once-on-boot', () => this.requestAdvertisement(), 15000, false, true);
        task.scheduleTask('peer-request-advertisement', () => this.requestAdvertisement(), 60000);
        task.scheduleTask('peer-sync-advertisement-once-on-boot', () => this.requestAdvertisementSync(), 15000, false, true);
        task.scheduleTask('peer-sync-advertisement', () => this.requestAdvertisementSync(), 60000);
        task.scheduleTask('advertisement-payment-process', () => this.processAdvertisementPayment(), 60000);
        task.scheduleTask('advertiser-pending-payment-prune', () => this.pruneAdvertiserPendingPaymentQueue(), 30000);
        task.scheduleTask('advertisement-queue-prune', () => this.pruneConsumerAdvertisementQueue(), 30000);
        task.scheduleTask('advertisement-queue-process', () => this.processAdvertisementQueue(), 30000, true);
        task.scheduleTask('node-update-throttled-ip-address', () => this.updateThrottledIpAddress(), 60000);
        task.scheduleTask('node-prune-message', () => this.clearMessageQueues(), 5000);
        task.scheduleTask('stats', () => this.showStats(), 10000);
        // ad network
        task.scheduleTask('advertisement-network:expire-request-log', () => this.advertisementNetworkExpireRequestLog(), 60000);
        task.scheduleTask('advertisement-network:expire-webmaster-request-log', () => this.advertisementNetworkExpireWebmasterRequestLog(), 60000);
        task.scheduleTask('advertisement-network:request-advertisement', () => this.advertisementNetworkRequestAdvertisement(), 60000);
        task.scheduleTask('advertisement-network:webmaster-advertisement-payment-process', () => this.processWebmasterAdvertisementPayment(), 60000);
        task.scheduleTask('advertisement-network:check-payment', () => this.advertisementNetworkCheckPayment(), 60000, true);

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
                                             return machineId().then(deviceID => {
                                                 this.deviceID = deviceID;
                                                 this.updateThrottledIpAddress();
                                             });

                                         }
                                         else {
                                             return Promise.reject(data);
                                         }
                                     });
                    });
    }

    _sendData(ws, payload) {
        try {
            ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
        }
        catch (e) {
            console.log('[WARN]: try to send data over a closed connection.');
            ws && ws.close();
            network._unregisterWebsocket(ws);
        }
    }

    stop() {
        eventBus.removeAllListeners('new_peer');
        eventBus.removeAllListeners('advertisement_request');
        eventBus.removeAllListeners('advertisement_network:advertisement_request');
        eventBus.removeAllListeners('advertisement_sync');
        eventBus.removeAllListeners('advertisement_payment_new');
        eventBus.removeAllListeners('advertisement_network:advertisement_sync');
        eventBus.removeAllListeners('advertisement_payment_request');
        eventBus.removeAllListeners('advertisement_payment_response');
        eventBus.removeAllListeners('peer_connection');
        eventBus.removeAllListeners('peer_connection_closed');

        task.removeTask('peer-request-advertisement-once-on-boot');
        task.removeTask('peer-request-advertisement');
        task.removeTask('peer-sync-advertisement');
        task.removeTask('advertisement-payment-process');
        task.removeTask('advertisement-queue-prune');
        task.removeTask('advertisement-queue-process');
        task.removeTask('node-update-throttled-ip-address');
        task.removeTask('advertisement-network:check-payment');
        task.removeTask('advertisement-network:webmaster-advertisement-payment-process');
        task.removeTask('advertisement-network:request-advertisement');
        task.removeTask('advertisement-network:expire-request-log');
        task.removeTask('advertisement-network:expire-webmaster-request-log');
    }
}


export default new Peer();
