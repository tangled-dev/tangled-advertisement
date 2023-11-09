import {Database} from '../database';
import ntp from '../../core/ntp';
import objectHash from '../../core/crypto/object-hash';

export default class Consumer {
    constructor(database) {
        this.database                = database;
        this.normalizationRepository = null;
    }

    setNormalizationRepository(repository) {
        this.normalizationRepository = repository;
    }


    getAdvertisementLedger(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.settlement_ledger', where);
            this.database.get(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                return resolve(data);
            });
        });
    }

    listAdvertisementLedger(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.settlement_ledger', where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                return resolve(data);
            });
        });
    }

    updateAdvertisementNetworkQueue(set, where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildUpdate('UPDATE advertisement_consumer.advertisement_network_queue', set, where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                return resolve(data);
            });
        });
    }

    listAdvertisementNetworkQueue(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.advertisement_network_queue', where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                return resolve(data);
            });
        });
    }

    addAdvertisementNetworkAdvertisement(advertisement, ledgerGUID, publisherGUID, requestGUID) {
        const now        = Math.floor(ntp.now() / 1000);
        const statements = [
            [
                `INSERT
                OR IGNORE INTO advertisement_consumer.advertisement_network_queue
                 (queue_guid,
                  ledger_guid,
                  publisher_guid,
                  advertisement_guid,
                  creative_request_guid,
                  bid_impression_mlx,
                  payment_request_date,
                  payment_received_date,
                  advertisement_url,
                  count_paid_impression,
                  expiration)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                Database.generateID(32),
                ledgerGUID,
                publisherGUID,
                advertisement.advertisement_guid,
                requestGUID,
                advertisement.bid_impression_mlx,
                now,
                null,
                advertisement.advertisement_url,
                advertisement.count_impression,
                advertisement.expiration
            ]
        ];

        advertisement.attributes.forEach(attribute => {
            statements.push([
                `INSERT
                OR IGNORE INTO advertisement_consumer.advertisement_attribute
                 (advertisement_attribute_guid,
                  advertisement_guid,
                  attribute_type_guid,
                  object_guid,
                  object_key,
                  value)
                 VALUES (?, ?, ?, ?, ?, ?);`,
                attribute.advertisement_attribute_guid,
                advertisement.advertisement_guid,
                this.normalizationRepository.get(attribute.attribute_type),
                this.normalizationRepository.get(attribute.object),
                attribute.object_key,
                attribute.value
            ]);
        });

        return this.database.runBatchAsync(statements);
    }

    addAdvertisement(advertisement, advertiserGUID, advertiserIpAddress, advertiserPort, requestGUID) {
        const statements = [
            [
                `INSERT INTO advertisement_consumer.advertisement_queue
                 (queue_guid,
                  advertisement_guid,
                  tangled_guid_advertiser,
                  ip_address_advertiser, -- (used to send settlement request and inform the advertiser of click)
                  port_advertiser,
                  creative_request_guid,
                  bid_impression_mlx,
                  advertisement_url,
                  expiration)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                Database.generateID(32),
                advertisement.advertisement_guid,
                advertiserGUID,
                advertiserIpAddress,
                advertiserPort,
                requestGUID,
                advertisement.bid_impression_mlx,
                advertisement.advertisement_url,
                advertisement.expiration
            ]
        ];

        advertisement.attributes.forEach(attribute => {
            statements.push([
                `INSERT
                OR IGNORE INTO advertisement_consumer.advertisement_attribute
                 (advertisement_attribute_guid,
                  advertisement_guid,
                  attribute_type_guid,
                  object_guid,
                  object_key,
                  value)
                 VALUES (?, ?, ?, ?, ?, ?);`,
                attribute.attribute_guid,
                advertisement.advertisement_guid,
                this.normalizationRepository.get(attribute.attribute_type),
                this.normalizationRepository.get(attribute.object),
                attribute.object_key,
                attribute.value
            ]);
        });

        return this.database.runBatchAsync(statements);
    }

    listAdvertisement(where, orderBy, limit) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.advertisement_queue', where, orderBy, limit);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                return resolve(data);
            });
        });
    }

    getRandomAdvertisementToRequestPayment() {
        return new Promise((resolve, reject) => {
            this.database.all(`SELECT *
                               FROM (SELECT *, RANDOM() as position
                                     FROM (SELECT *, RANDOM() as position
                                         FROM advertisement_queue
                                         WHERE payment_request_date IS NULL
                                         AND tangled_guid_advertiser NOT IN
                                         (SELECT DISTINCT tangled_guid_advertiser
                                         FROM advertisement_queue
                                         WHERE payment_request_date IS NOT NULL
                                         AND impression_date_first IS NULL)
                                         ORDER BY position)
                                     GROUP BY tangled_guid_advertiser
                                     ORDER BY position) LIMIT 10`, (err, data) => {
                if (err) {
                    return reject(err);
                }

                resolve(data);
            });
        });
    }

    getAdvertisementWithSettlementLedgerList(where = {}) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery(`SELECT *,
                                                  advertisement_consumer.advertisement_queue.advertisement_guid as advertisement_guid,
                                                  advertisement_consumer.advertisement_queue.create_date        as create_date
                                           FROM advertisement_consumer.settlement_ledger
                                                    JOIN advertisement_consumer.advertisement_queue
                                                         ON advertisement_consumer.settlement_ledger.ledger_guid =
                                                            advertisement_consumer.advertisement_queue.ledger_guid`, where);

            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }

    getAdvertisement(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.advertisement_queue', where);
            this.database.get(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }

    fillAdvertisementAttributes(advertisement) {
        return new Promise((resolve, reject) => {
            advertisement['attributes'] = [];
            this.database.all(`SELECT *
                               FROM advertisement_consumer.advertisement_attribute
                               WHERE advertisement_guid = ?`, [advertisement.advertisement_guid], (err, data) => {
                if (err) {
                    return reject(err);
                }

                data.forEach(attribute => {
                    advertisement.attributes.push({
                        attribute_guid: attribute.advertisement_attribute_guid,
                        attribute_type: this.normalizationRepository.getType(attribute.attribute_type_guid),
                        object        : this.normalizationRepository.getType(attribute.object_guid),
                        value         : attribute.value
                    });
                });

                resolve(advertisement);
            });
        });
    }

    processRandomAdvertisement(advertisement) {
        if (!advertisement.count_impression) {
            advertisement.count_impression = 1;
        }
        else {
            advertisement.count_impression += 1;
        }

        this.database.run('UPDATE advertisement_consumer.advertisement_queue SET count_impression = ?1, impression_date_first = COALESCE(impression_date_first, ?2), impression_date_last = ?2 WHERE queue_id = ?3', [
            advertisement.count_impression,
            Math.floor(Date.now() / 1000),
            advertisement.queue_id
        ], _ => _);

        return this.fillAdvertisementAttributes(advertisement);
    }

    getRandomAdvertisementToShow() {
        return new Promise((resolve, reject) => {
            return this.database.get(`SELECT *
                                      FROM advertisement_consumer.advertisement_queue
                                      WHERE count_impression IS NULL
                                        AND protocol_transaction_id IS NOT NULL
                                      ORDER BY RANDOM() LIMIT 1`, [], (err, advertisement) => {

                if (err) {
                    return reject(err);
                }

                if (!advertisement) {
                    return resolve({});
                }

                return this.processRandomAdvertisement(advertisement).then(resolve).catch(reject);
            });
        });
    }

    addAdvertisementPaymentSettlement(paymentData) {
        const ledgerGUID = Database.generateID(32);
        const statements = [
            [
                `UPDATE advertisement_consumer.advertisement_queue
                 SET ledger_guid              = ?,
                     protocol_transaction_id  = ?,
                     protocol_output_position = ?,
                     payment_received_date    = CAST(strftime("%s", "now") AS INTEGER),
                     payment_request_date     = COALESCE(payment_request_date,
                                                         CAST(strftime("%s", "now") AS INTEGER))
                 WHERE creative_request_guid = ?
                   AND advertisement_guid = ?`,
                ledgerGUID,
                paymentData.protocol_transaction_id,
                paymentData.protocol_output_position,
                paymentData.advertisement_request_guid,
                paymentData.advertisement_guid
            ],
            [
                `INSERT
                OR REPLACE INTO advertisement_consumer.settlement_ledger (ledger_guid,
                                                                       advertisement_request_guid,
                                                                       protocol_address_hash,
                                                                       protocol_transaction_id,
                                                                       protocol_output_position,
                                                                       tx_address_deposit_vout_md5,
                                                                       deposit,
                                                                       price_usd)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                ledgerGUID,
                paymentData.advertisement_request_guid,
                paymentData.protocol_address_hash,
                paymentData.protocol_transaction_id,
                paymentData.protocol_output_position,
                paymentData.tx_address_deposit_vout_md5,
                paymentData.deposit,
                paymentData.price_usd
            ]
        ];
        return this.database.runBatchAsync(statements);
    }

    resetAdvertisementPendingPayment(timestamp) {
        return this.update({payment_request_date: null}, {
            'payment_received_date'   : null,
            'payment_request_date_max': timestamp
        });
    }

    update(set, where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildUpdate('UPDATE advertisement_consumer.advertisement_queue', set, where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                return resolve(data);
            });
        });
    }

    pruneAdvertisementAttribute() {
        return new Promise((resolve, reject) => {
            this.database.run(`DELETE
                               FROM advertisement_consumer.advertisement_attribute
                               WHERE advertisement_guid NOT IN
                                     (SELECT advertisement_guid
                                      FROM advertisement_consumer.advertisement_queue)`, (err) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

                resolve();
            });
        });
    }

    pruneAdvertisementQueue(timestamp) {
        return new Promise((resolve, reject) => {
            this.database.run(`DELETE
                               FROM advertisement_consumer.advertisement_queue
                               WHERE create_date <= ?
                                 AND payment_received_date IS NULL`, [timestamp], (err) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

                this.database.run(`DELETE
                                   FROM advertisement_consumer.advertisement_queue
                                   WHERE payment_received_date <= ?`, [timestamp], (err) => {
                    if (err) {
                        console.log('[database] error', err);
                        return this.pruneAdvertisementAttribute().then(() => reject(err)).then(err1 => reject(err1));
                    }

                    return this.pruneAdvertisementAttribute().then(() => resolve()).then(err1 => reject(err1));
                });
            });
        });
    }

    deleteAdvertisement(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('DELETE FROM advertisement_consumer.advertisement_queue', where);

            this.database.run(sql, parameters, (err) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

                return this.pruneAdvertisementAttribute().then(() => resolve()).then(err1 => reject(err1));
            });
        });
    }

    getLastAdvertisementPaymentDate() {
        return new Promise((resolve, reject) => {
            this.database.get(`SELECT max(payment_received_date) as last_payment_received_date
                               FROM advertisement_consumer.advertisement_queue`, (err, data) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

                resolve(data?.last_payment_received_date);
            });
        });
    }

    getTotalAdvertisementPayment(where = {}) {
        return new Promise((resolve, reject) => {
            where   = {
                'payment_received_date!': null,
                ...where
            };
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT SUM(bid_impression_mlx) as total FROM advertisement_consumer.advertisement_queue', where);
            this.database.get(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                return resolve(data.total);
            });
        });
    }

    addAdvertisementNetworkPublisher(publisherGuid,
                                     publisherName,
                                     publisherDomain,
                                     addressHash,
                                     addressKeyPublic) {
        return new Promise((resolve, reject) => {
            this.database.run(`INSERT
            OR REPLACE INTO advertisement_consumer.advertisement_network_publisher (
                    publisher_guid, publisher_name, publisher_domain, protocol_address_hash, protocol_address_key_public
                    ) VALUES (?, ?, ?, ?, ?)`, [
                publisherGuid,
                publisherName,
                publisherDomain,
                addressHash,
                addressKeyPublic
            ], (err) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

                resolve();
            });
        });
    }

    getAdvertisementNetworkPublisher(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.advertisement_network_publisher', where);
            this.database.get(sql, parameters, (err, advertisementNetworkPublisher) => {
                if (err) {
                    return reject(err);
                }
                resolve(advertisementNetworkPublisher);
            });
        });
    }

    addAdvertisementNetworkWebmaster(webmasterGUID,
                                     webmasterName,
                                     webmasterDomain,
                                     addressHash,
                                     addressKeyPublic,
                                     webmasterCallbackURL) {
        return new Promise((resolve, reject) => {
            this.database.run(`INSERT
            OR REPLACE INTO advertisement_consumer.advertisement_network_webmaster (
                    webmaster_guid, webmaster_name, webmaster_domain, protocol_address_hash, protocol_address_key_public, webmaster_callback_url
                    ) VALUES (?, ?, ?, ?, ?, ?)`, [
                webmasterGUID,
                webmasterName,
                webmasterDomain,
                addressHash,
                addressKeyPublic,
                webmasterCallbackURL
            ], (err) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

                resolve();
            });
        });
    }

    getAdvertisementNetworkWebmaster(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.advertisement_network_webmaster', where);
            this.database.get(sql, parameters, (err, advertisementNetworkWebmaster) => {
                if (err) {
                    return reject(err);
                }
                resolve(advertisementNetworkWebmaster);
            });
        });
    }

    listAdvertisementNetworkWebmaster(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.advertisement_network_webmaster', where);
            this.database.all(sql, parameters, (err, advertisementNetworkWebmasterList) => {
                if (err) {
                    return reject(err);
                }
                resolve(advertisementNetworkWebmasterList);
            });
        });
    }

    listAdvertisementNetworkPublisher(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.advertisement_network_publisher', where);
            this.database.all(sql, parameters, (err, advertisementNetworkPublisherList) => {
                if (err) {
                    return reject(err);
                }
                resolve(advertisementNetworkPublisherList);
            });
        });
    }

    addAdvertisementLedger(advertisementRequestGUID, protocolAddressHash, protocolTransactionId, protocolOutputPosition, deposit, priceUSD) {
        return new Promise((resolve, reject) => {
            const ledgerGUID                       = Database.generateID(32);
            const transactionAddressDepositVOutMd5 = objectHash.getMD5Buffer(`${protocolTransactionId}${protocolAddressHash}${protocolOutputPosition}${deposit}`).toString('hex');
            this.database.run(`
                INSERT
                OR IGNORE INTO advertisement_consumer.settlement_ledger (ledger_guid,
                                                                       advertisement_request_guid,
                                                                       protocol_address_hash,
                                                                       protocol_transaction_id,
                                                                       protocol_output_position,
                                                                       tx_address_deposit_vout_md5,
                                                                       deposit,
                                                                       price_usd)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                ledgerGUID,
                advertisementRequestGUID,
                protocolAddressHash,
                protocolTransactionId,
                protocolOutputPosition,
                transactionAddressDepositVOutMd5,
                deposit,
                priceUSD
            ], (err) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

                this.database.get(`SELECT *
                                   FROM advertisement_consumer.settlement_ledger
                                   WHERE tx_address_deposit_vout_md5 = ?`, [transactionAddressDepositVOutMd5], (err, data) => {
                    if (err) {
                        console.log('[database] error', err);
                        return reject(err);
                    }

                    resolve(data);
                });
            });
        });
    }

    updateLedger(set, where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildUpdate('UPDATE advertisement_consumer.settlement_ledger', set, where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                return resolve(data);
            });
        });
    }

    listAdvertisementNetworkWebmasterQueue(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.advertisement_network_webmaster_queue', where);
            this.database.all(sql, parameters, (err, advertisementNetworkPublisherList) => {
                if (err) {
                    return reject(err);
                }
                resolve(advertisementNetworkPublisherList);
            });
        });
    }

    updateAdvertisementNetworkWebmasterQueue(set, where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildUpdate('UPDATE advertisement_consumer.advertisement_network_webmaster_queue', set, where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                return resolve(data);
            });
        });
    }

    processRandomAdvertisementNetworkAdvertisement(advertisement, webmasterGUID, webmasterTargetGUID, webmasterTargetIpAddress, webmasterTargetLanguage) {
        return new Promise((resolve, reject) => {
            advertisement.count_impression += 1;
            this.database.run('UPDATE advertisement_consumer.advertisement_network_queue SET count_impression = ?1, impression_date_first = COALESCE(impression_date_first, ?2), impression_date_last = ?2 WHERE queue_id = ?3', [
                advertisement.count_impression,
                Math.floor(Date.now() / 1000),
                advertisement.queue_id
            ], (err) => {
                if (err) {
                    reject(err);
                }

                const queueID = Database.generateID(32);
                this.database.run(`INSERT INTO advertisement_consumer.advertisement_network_webmaster_queue (queue_guid,
                                                                                                             webmaster_guid,
                                                                                                             webmaster_target_guid,
                                                                                                             webmaster_target_ip_address,
                                                                                                             webmaster_target_language,
                                                                                                             advertisement_network_queue_guid,
                                                                                                             bid_impression_mlx,
                                                                                                             advertisement_url)
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    queueID,
                    webmasterGUID,
                    webmasterTargetGUID,
                    webmasterTargetIpAddress,
                    webmasterTargetLanguage,
                    advertisement.queue_guid,
                    advertisement.bid_impression_mlx,
                    advertisement.advertisement_url
                ], (err) => {
                    if (err) {
                        reject(err);
                    }

                    advertisement['webmaster_target_guid'] = webmasterTargetGUID;
                    advertisement['webmaster_queue_guid']  = queueID;
                    resolve();
                });
            });
        }).then(() => {
            return this.fillAdvertisementAttributes(advertisement);
        });
    }

    getRandomAdvertisementNetworkAdvertisement(webmasterGUID, webmasterTargetGUID, webmasterTargetIpAddress, webmasterTargetLanguage) {
        return new Promise((resolve, reject) => {
            return this.database.get(`SELECT *
                                      FROM advertisement_consumer.advertisement_network_queue
                                      WHERE queue_guid NOT IN
                                            (SELECT advertisement_network_queue_guid
                                             FROM advertisement_consumer.advertisement_network_webmaster_queue
                                             WHERE webmaster_guid = ?
                                               AND webmaster_target_guid = ?
                                               AND status = 1)
                                        AND status = 1
                                        AND payment_received_date IS NOT NULL
                                        AND count_impression < count_paid_impression
                                      ORDER BY RANDOM() LIMIT 1`,
                [
                    webmasterGUID,
                    webmasterTargetGUID
                ], (err, advertisement) => {

                    if (err) {
                        return reject(err);
                    }

                    if (!advertisement) {
                        return reject({message: 'no_advertisement_available'});
                    }

                    return this.processRandomAdvertisementNetworkAdvertisement(advertisement, webmasterGUID, webmasterTargetGUID, webmasterTargetIpAddress, webmasterTargetLanguage).then(resolve).catch(reject);
                });
        });
    }
}
