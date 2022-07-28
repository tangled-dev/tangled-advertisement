import {Database} from '../database';

export default class Consumer {
    constructor(database) {
        this.database                = database;
        this.normalizationRepository = null;
    }

    setNormalizationRepository(repository) {
        this.normalizationRepository = repository;
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

    getAdvertisementWithSettlementLedgerList(where = '') {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery(`SELECT *,
                                                  advertisement_consumer.advertisement_queue.advertisement_guid as advertisement_guid,
                                                  advertisement_consumer.settlement_ledger.create_date          as payment_date,
                                                  advertisement_consumer.advertisement_queue.create_date        as presentation_date
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

                    // randomly decide if we should show a new ad (33% prob.)
                    if (Math.random() <= 4 / 5) {
                        return resolve({});
                    }

                    const afterLastImpressionDate = Math.floor(Date.now() / 1000) - 120;
                    return this.database.get(`SELECT *
                                              FROM advertisement_consumer.advertisement_queue
                                              WHERE protocol_transaction_id IS NOT NULL
                                                AND impression_date_last < ?
                                              ORDER BY RANDOM() LIMIT 1`, [afterLastImpressionDate], (err, advertisement) => {

                        if (err) {
                            return reject(err);
                        }

                        if (!advertisement) {
                            return resolve({});
                        }

                        return this.processRandomAdvertisement(advertisement).then(resolve).catch(reject);
                    });
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

    pruneAdvertisementQueue(timestamp) {
        return new Promise((resolve, reject) => {
            this.database.run(`DELETE
                               FROM advertisement_consumer.advertisement_queue
                               WHERE create_date <= ?`, [timestamp], (err) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

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
        });
    }
}
