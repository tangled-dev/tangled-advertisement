import {Database} from '../database';
import _ from 'lodash'

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
                `INSERT OR IGNORE INTO advertisement_consumer.advertisement_attribute
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

    listAdvertisement(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.advertisement_queue', where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }

                if (data.length === 0) {
                    return resolve(data);
                }
                const advertisements = {};
                data.forEach(advertisement => {
                    advertisements[advertisement.advertisement_guid] = {
                        ...advertisement,
                        attributes: []
                    };
                });

                const advertisementGUIDs = _.keys(advertisements);
                this.database.all(`SELECT *
                                   FROM advertisement_consumer.advertisement_attribute
                                   WHERE advertisement_guid IN (${advertisementGUIDs.map(() => '?').join(',')})`, advertisementGUIDs, (err, data) => {
                    if (err) {
                        return reject(err);
                    }

                    data.forEach(attribute => {
                        advertisements[attribute.advertisement_guid].attributes.push({
                            attribute_guid: attribute.advertisement_attribute_guid,
                            attribute_type: this.normalizationRepository.getType(attribute.attribute_type_guid),
                            object        : this.normalizationRepository.getType(attribute.object_guid),
                            value         : attribute.value
                        });
                    });

                    resolve(_.values(advertisements));
                });

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

        this.database.run('UPDATE advertisement_consumer.advertisement_queue SET count_impression = ? WHERE queue_id = ?', [
            advertisement.count_impression,
            advertisement.queue_id
        ], _ => _);

        return this.fillAdvertisementAttributes(advertisement);
    }

    getRandomAdvertisement() {
        return new Promise((resolve, reject) => {
            return this.database.get(`SELECT *
                                      FROM advertisement_consumer.advertisement_queue
                                      WHERE count_impression IS NULL
                                      ORDER BY RANDOM()
                                      LIMIT 1`, [], (err, advertisement) => {

                if (err) {
                    return reject(err);
                }

                if (!advertisement) {
                    return this.database.get(`SELECT *
                                              FROM advertisement_consumer.advertisement_queue
                                              ORDER BY RANDOM()
                                              LIMIT 1`, [], (err, advertisement) => {

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
                     protocol_output_position = ?
                 WHERE creative_request_guid = ?
                   AND advertisement_guid = ?`,
                ledgerGUID,
                paymentData.protocol_transaction_id,
                paymentData.protocol_output_position,
                paymentData.advertisement_request_guid,
                paymentData.advertisement_guid
            ],
            [
                `INSERT INTO advertisement_consumer.settlement_ledger (ledger_guid,
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


    pruneAdvertisementRequestWithNoPaymentRequestQueue(timestamp) {
        return new Promise((resolve, reject) => {
            this.database.run(`DELETE
                               FROM advertisement_consumer.advertisement_queue
                               WHERE create_date <= ? AND protocol_transaction_id IS NULL AND coalesce(count_impression,  0) > 0`, [timestamp], (err) => {
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
