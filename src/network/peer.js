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
        this._messageResponseQueue                  = {};
        this._throttleAdvertisementRequestByNode    = {};
        this._throttleAdvertisementSyncByNode       = {};
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
        _.each(queue, (value, key) => {
            if (value?.timestamp < Date.now() - 60000) {
                delete queue[key];
            }
        });
    }

    clearMessageQueues() {
        this._pruneMessageQueue(this._proxyAdvertisementRequestQueue);
        this._pruneMessageQueue(this._proxyAdvertisementSyncQueue);
        this._pruneMessageQueue(this._proxyAdvertisementPaymentRequestQueue);
        this._pruneMessageQueue(this._advertisementPaymentRequestQueue);
        this._pruneMessageQueue(this._throttleAdvertisementRequestByNode);
        this._pruneMessageQueue(this._throttleAdvertisementSyncByNode);
        this._pruneMessageQueue(this._advertisementRequestQueue);
        this._pruneMessageQueue(this._messageResponseQueue);
        this._pruneMessageQueue(this._advertisementSyncQueue);
    }

    _onNewAdvertisement(data) {
        if (data.message_guid && this._messageResponseQueue[data.message_guid]) {
            return;
        }

        this._messageResponseQueue[data.message_guid] = {
            timestamp: Date.now()
        };

        if (this._proxyAdvertisementRequestQueue[data.request_guid]) {
            const ws      = this._proxyAdvertisementRequestQueue[data.request_guid].ws;
            const payload = {
                type   : 'advertisement_new',
                content: data
            };
            ws.send(JSON.stringify(payload));
        }
        else if (this._advertisementRequestQueue[data.request_guid]) {
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
    }

    _onSyncAdvertisement(data) {
        if (data.message_guid && this._messageResponseQueue[data.message_guid]) {
            return;
        }

        this._messageResponseQueue[data.message_guid] = {
            timestamp: Date.now()
        };

        if (this._proxyAdvertisementSyncQueue[data.request_guid]) {
            const ws      = this._proxyAdvertisementSyncQueue[data.request_guid].ws;
            const payload = {
                type   : 'advertisement_sync',
                content: data
            };
            ws.send(JSON.stringify(payload));
        }
        else if (this._advertisementSyncQueue[data.request_guid]) {
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
    }

    _onNewPeer(peer, ws) {
        eventBus.emit('tangled_event_log', {
            type   : 'new_peer',
            content: peer,
            from   : ws.node
        });

        network.addNode(peer.node_prefix, peer.node_address, peer.node_port, peer.node_id, true);
    }

    _onAdvertisementSyncRequest(data, ws) {
        if (!data.node_id || !data.request_guid ||
            this._throttleAdvertisementSyncByNode[data.node_id] ||
            this._proxyAdvertisementSyncQueue[data.request_guid] ||
            this._advertisementSyncQueue[data.request_guid]) {
            return;
        }

        this.stats['advertisement_request_sync'] += 1;

        this._proxyAdvertisementSyncQueue[data.request_guid] = {
            timestamp: Date.now(),
            ws
        };
        this._throttleAdvertisementSyncByNode[data.node_id]  = {
            timestamp: Date.now()
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
                                        message_guid      : Database.generateID(32),
                                        advertisement_list: advertisements
                                    }
                                };
                                ws.send(JSON.stringify(payload));
                            });
    }

    _onAdvertisementRequest(data, ws) {
        if (this._ipAddressesThrottled.has(data.node_ip_address) ||
            !data.protocol_address_key_identifier ||
            !data.device_id ||
            this._proxyAdvertisementRequestQueue[data.request_guid] ||
            this._advertisementRequestQueue[data.request_guid] ||
            this._throttleAdvertisementRequestByNode[data.device_id] ||
            this._throttleAdvertisementRequestByNode[data.node_id] ||
            config.MODE_TEST === false && !data.protocol_address_key_identifier.startsWith('1') ||
            config.MODE_TEST === true && data.protocol_address_key_identifier.startsWith('1')) {
            return;
        }

        this.stats['advertisement_request'] += 1;

        this._proxyAdvertisementRequestQueue[data.request_guid]  = {
            timestamp: Date.now(),
            ws
        };
        this._throttleAdvertisementRequestByNode[data.device_id] = this._throttleAdvertisementRequestByNode[data.node_id] = {
            timestamp: Date.now()
        };

        this.propagateRequest('advertisement_request', data, ws);

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
                                        `${config.EXTERNAL_API_IP_CHECK}?p1=${data.node_ip_address}`,
                                        (error, response, body) => {
                                            if (!error && response.statusCode === 200) {
                                                const data                                        = JSON.parse(body);
                                                const isValid                                     = !!data.is_valid;
                                                this._ipAddressesValidation[data.node_ip_address] = isValid;
                                                resolve([
                                                    advertisements,
                                                    adCount,
                                                    isValid
                                                ]);
                                            }
                                            else {
                                                resolve([
                                                    advertisements,
                                                    adCount,
                                                    true
                                                ]);
                                            }
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
                                        advertisement_list: advertisements
                                    }
                                };
                                ws.send(JSON.stringify(payload));
                            });
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

        cache.setCacheItem('peer', `peer_list_${ws.connectionID}`, cachedData, Number.MAX_SAFE_INTEGER);
    }

    notifyNewPeer(peerWS) {
        const payload = {
            type   : 'new_peer',
            content: {
                node_id     : peerWS.nodeID,
                node_prefix : peerWS.nodePrefix,
                node_address: peerWS.nodeIPAddress,
                node_port   : peerWS.nodePort
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
                timestamp   : Date.now(),
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
                device_id                      : this.deviceID,
                request_guid                   : requestID,
                timestamp                      : Date.now(),
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
        const key                  = `${data.request_guid}_${data.advertisement_guid}`;
        const advertiserRepository = database.getRepository('advertiser');
        if (!data.advertisement_guid ||
            !data.request_guid ||
            this._advertisementPaymentRequestQueue[key] ||
            this._proxyAdvertisementPaymentRequestQueue[key]) {
            return;
        }

        this._proxyAdvertisementPaymentRequestQueue[key] = {
            timestamp: Date.now(),
            ws
        };

        this.propagateRequest('advertisement_payment_request', data, ws);

        if (!advertiserRepository.getAdvertisementGUIDCached().has(data.advertisement_guid)) {
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

        if (data.message_guid && this._messageResponseQueue[data.message_guid] ||
            !this._proxyAdvertisementPaymentRequestQueue[key] &&
            !this._advertisementPaymentRequestQueue[key]) {
            return;
        }

        this.stats['advertisement_payment_response'] += 1;

        this._messageResponseQueue[data.message_guid] = {
            timestamp: Date.now()
        };

        if (this._proxyAdvertisementPaymentRequestQueue[key]) {
            const ws      = this._proxyAdvertisementPaymentRequestQueue[key].ws;
            const payload = {
                type   : 'advertisement_payment_response',
                content: data
            };
            ws.send(JSON.stringify(payload));
        }
        else if (this._advertisementPaymentRequestQueue[key]) {
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
        if (!data.message_guid || this._messageResponseQueue[data.message_guid]) {
            return;
        }

        this._messageResponseQueue[data.message_guid] = {
            timestamp: Date.now()
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
                                    timestamp                : Date.now(),
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
                timestamp   : Date.now(),
                message_guid: Database.generateID(32)
            }
        };

        this._advertisementPaymentRequestQueue[`${payload.content.request_guid}_${payload.content.advertisement_guid}`] = {
            timestamp: Date.now()
        };

        const data = JSON.stringify(payload);
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

        //out
        eventBus.on('peer_connection', this._onPeerConnection.bind(this));

        //other
        eventBus.on('peer_connection_closed', this._onPeerDisconnection.bind(this));

        task.scheduleTask('peer-request-advertisement-once-on-boot', () => this.requestAdvertisement(), 15000, false, true);
        task.scheduleTask('peer-request-advertisement', () => this.requestAdvertisement(), 60000);
        task.scheduleTask('peer-sync-advertisement', () => this.requestAdvertisementSync(), 10000);
        task.scheduleTask('advertisement-payment-process', () => this.processAdvertisementPayment(), 60000);
        task.scheduleTask('advertiser-pending-payment-prune', () => this.pruneAdvertiserPendingPaymentQueue(), 30000);
        task.scheduleTask('advertisement-queue-prune', () => this.pruneConsumerAdvertisementQueue(), 30000);
        task.scheduleTask('advertisement-queue-process', () => this.processAdvertisementQueue(), 15000, true);
        task.scheduleTask('node-update-throttled-ip-address', () => this.updateThrottledIpAddress(), 60000);
        task.scheduleTask('node-prune-message', () => this.clearMessageQueues(), 60000);
        task.scheduleTask('stats', () => this.showStats(), 10000);
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

    stop() {
        eventBus.removeAllListeners('new_peer');
        eventBus.removeAllListeners('advertisement_request');
        eventBus.removeAllListeners('advertisement_sync');
        eventBus.removeAllListeners('advertisement_payment_new');
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
    }
}


export default new Peer();
