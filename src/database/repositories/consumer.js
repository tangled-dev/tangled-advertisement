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
                `INSERT INTO advertisement_consumer.advertisement_attribute
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

    getRandomAdvertisement() {
        return new Promise((resolve, reject) => {
            return this.database.get(`SELECT *
                                              FROM advertisement_consumer.advertisement_queue
                                              ORDER BY RANDOM()
                                              LIMIT 1`, [], (err, advertisement) => {

                if (err) {
                    return reject(err);
                }

                if (!advertisement) {
                    resolve({});
                }

                return this.fillAdvertisementAttributes(advertisement).then(resolve).catch(reject);
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


    pruneAdvertisementQueue(timestamp) {
        return new Promise((resolve, reject) => {
            this.database.all('select * from advertisement_consumer.advertisement_queue where create_date <= ? limit 1000', [timestamp], (err, data) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

                const advertisementGUIDListToRemove = data.map(advertisement => advertisement.advertisement_guid);
                this.database.run(`delete from advertisement_consumer.advertisement_attribute where advertisement_guid in (${advertisementGUIDListToRemove.map(() => '?').join(',')}`, advertisementGUIDListToRemove, (err) => {
                    if (err) {
                        console.log('[database] error', err);
                        return reject(err);
                    }

                    this.database.run(`delete from advertisement_consumer.advertisement_queue where advertisement_guid in (${advertisementGUIDListToRemove.map(() => '?').join(',')}`, advertisementGUIDListToRemove, (err) => {
                        if (err) {
                            console.log('[database] error', err);
                            return reject(err);
                        }
                    });
                });
            });
        });
    }
}
