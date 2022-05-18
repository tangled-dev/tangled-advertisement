import {Database} from '../database';
import config from '../../config/config';
import objectHash from '../../core/crypto/object-hash';
import _ from 'lodash';

export default class Advertiser {
    constructor(database) {
        this.database                = database;
        this.normalizationRepository = null;
    }

    setNormalizationRepository(repository) {
        this.normalizationRepository = repository;
    }

    getAdvertisementIfPaymentNotFound(advertisementGUID, requestGUID) {
        return new Promise((resolve, reject) => {
            this.database.get(`SELECT *
                               FROM advertisement_advertiser.advertisement
                               WHERE NOT EXISTS(
                                   SELECT advertisement_request_guid
                                   FROM advertisement_advertiser.advertisement_ledger
                                   WHERE advertisement_guid = ?1
                                     AND advertisement_request_guid = ?2)
                                 AND EXISTS(
                                   SELECT advertisement_request_guid
                                   FROM advertisement_advertiser.advertisement_request_log
                                   WHERE advertisement_guid = ?1
                                     AND advertisement_request_guid = ?2)
                                 AND advertisement_guid = ?1
                                 AND status = 1`,
                [
                    advertisementGUID,
                    requestGUID
                ],
                (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(data);
                });
        });
    }

    getAdvertisementByProtocolAddressFunding(protocolAddressFunding) {
        return this.getAdvertisementList({protocol_address_funding: protocolAddressFunding});
    }

    listAdvertisementType(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_advertiser.advertisement_type', where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                if (data.length === 0) {
                    return resolve(data);
                }
                const types = {};
                data.forEach(type => {
                    types[type.advertisement_type_guid] = {
                        ...type
                    };
                });

                resolve(_.values(types));
            });
        });
    }

    toggleAdvertisementStatus(advertisement_guid) {
        let where = {advertisement_guid: advertisement_guid};
        let set   = [];

        return this.getAdvertisement({advertisement_guid: advertisement_guid}).then(advertisement => {

            set['status'] = advertisement.status == 1 ? 0 : 1;
            return new Promise((resolve, reject) => {
                const {
                          sql,
                          parameters
                      } = Database.buildUpdate(`UPDATE advertisement_advertiser.advertisement`, set, where);
                this.database.run(sql, parameters, (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });

        }).catch(e => res.send({
            api_status : 'fail',
            api_message: `unexpected generic api error: (${e})`
        }));
    }

    listCategory(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_advertiser.advertisement_category', where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }

                if (data.length === 0) {
                    return resolve(data);
                }

                const categories = {};
                data.forEach(category => {
                    categories[category.advertisement_category_guid] = {
                        ...category
                    };
                });

                resolve(_.values(categories));
            });
        });
    }

    getCategory(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_category', where);
            this.database.get(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }

                resolve(data);
            });
        });
    }

    getCategoryByGuid(categoryGuid) {
        return this.getCategory({advertisement_category_guid: categoryGuid});
    }

    syncAdvertisementToConsumer(consumerGUID, deviceGUID) {
        return new Promise((resolve, reject) => {
            this.database.all(`SELECT *
                               FROM advertisement_advertiser.advertisement
                               WHERE advertisement_guid NOT IN
                                     (SELECT advertisement_guid
                                      FROM advertisement_advertiser.advertisement_request_log
                                      WHERE tangled_guid_consumer = ?
                                        AND status = 1)
                                 AND advertisement_guid NOT IN
                                     (SELECT advertisement_guid
                                      FROM advertisement_advertiser.advertisement_request_log
                                      WHERE tangled_guid_device = ?
                                        AND status = 1)
                                 AND status = 1`, [
                consumerGUID,
                deviceGUID
            ], (err, data) => {
                if (err) {
                    return reject(err);
                }

                if (data.length === 0) {
                    return resolve(data);
                }
                const advertisements = {};
                data.forEach(advertisement => {
                    advertisements[advertisement.advertisement_guid] = {
                        advertisement_guid      : advertisement.advertisement_guid,
                        advertisement_type      : this.normalizationRepository.getType(advertisement.advertisement_type_guid),
                        advertisement_category  : this.normalizationRepository.getType(advertisement.advertisement_category_guid),
                        advertisement_name      : advertisement.advertisement_name,
                        advertisement_url       : advertisement.advertisement_url,
                        protocol_address_funding: advertisement.protocol_address_funding,
                        budget_daily_usd        : advertisement.budget_daily_usd,
                        budget_daily_mlx        : advertisement.budget_daily_mlx,
                        bid_impression_usd      : advertisement.bid_impression_usd,
                        bid_impression_mlx      : advertisement.bid_impression_mlx,
                        expiration              : advertisement.expiration,
                        attributes              : []
                    };
                });

                const advertisementGUIDs = _.keys(advertisements);
                this.database.all(`SELECT *
                                   FROM advertisement_advertiser.advertisement_attribute
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

    listConsumerActiveAdvertisement(consumerGUID) {
        return new Promise((resolve, reject) => {
            this.database.all(`SELECT a.*, r.advertisement_request_guid
                               FROM advertisement_advertiser.advertisement_request_log r
                                        INNER JOIN advertisement_advertiser.advertisement a
                                                   USING (advertisement_guid)
                                        LEFT JOIN advertisement_ledger l
                                                  ON l.advertisement_guid =
                                                     r.advertisement_guid and
                                                     l.advertisement_request_guid =
                                                     r.advertisement_request_guid
                               WHERE r.tangled_guid_consumer = ?
                                 AND r.status = 1
                                 AND a.status = 1
                                 AND l.ledger_guid IS NULL`, [consumerGUID], (err, data) => {
                if (err) {
                    return reject(err);
                }

                if (data.length === 0) {
                    return resolve(data);
                }
                const advertisements = {};
                data.forEach(advertisement => {
                    advertisements[advertisement.advertisement_guid] = {
                        advertisement_request_guid: advertisement.advertisement_request_guid,
                        advertisement_guid        : advertisement.advertisement_guid,
                        advertisement_type        : this.normalizationRepository.getType(advertisement.advertisement_type_guid),
                        advertisement_category    : this.normalizationRepository.getType(advertisement.advertisement_category_guid),
                        advertisement_name        : advertisement.advertisement_name,
                        advertisement_url         : advertisement.advertisement_url,
                        protocol_address_funding  : advertisement.protocol_address_funding,
                        budget_daily_usd          : advertisement.budget_daily_usd,
                        budget_daily_mlx          : advertisement.budget_daily_mlx,
                        bid_impression_usd        : advertisement.bid_impression_usd,
                        bid_impression_mlx        : advertisement.bid_impression_mlx,
                        expiration                : advertisement.expiration,
                        attributes                : []
                    };
                });

                const advertisementGUIDs = _.keys(advertisements);
                this.database.all(`SELECT *
                                   FROM advertisement_advertiser.advertisement_attribute
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

    logAdvertisementRequest(guid, deviceGUID, consumerGUID, ipAddress, requestGUID, protocolAddressKeyIdentifier, rawRequest) {
        return new Promise((resolve, reject) => {
            this.database.run(`INSERT INTO advertisement_advertiser.advertisement_request_log
                               (log_guid,
                                advertisement_guid,
                                advertisement_request_guid,
                                tangled_guid_consumer,
                                tangled_guid_device,
                                ip_address_consumer,
                                protocol_address_key_identifier,
                                advertisement_request_raw)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?);`, [
                Database.generateID(32),
                guid,
                requestGUID,
                consumerGUID,
                deviceGUID,
                ipAddress,
                protocolAddressKeyIdentifier,
                rawRequest
            ], (err) => {
                if (err) {
                    return reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }

    createAdvertisement(guid, type, category,
                        name, url, fundingAddress, budgetUSD, budgetMLX,
                        bidImpressionUSD, bidImpressionMLX, expiration, attributes) {
        const typeGUID     = this.normalizationRepository.get(type);
        const categoryGUID = this.normalizationRepository.get(category);
        const statements   = [
            [
                `INSERT INTO advertisement_advertiser.advertisement (advertisement_guid,
                                                                     advertisement_type_guid,
                                                                     advertisement_category_guid,
                                                                     advertisement_name,
                                                                     advertisement_url,
                                                                     protocol_address_funding,
                                                                     budget_daily_usd,
                                                                     budget_daily_mlx,
                                                                     bid_impression_usd,
                                                                     bid_impression_mlx,
                                                                     expiration)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                guid,
                typeGUID,
                categoryGUID,
                name,
                url,
                fundingAddress,
                budgetUSD,
                budgetMLX,
                bidImpressionUSD,
                bidImpressionMLX,
                expiration
            ]
        ];

        attributes.forEach(attribute => {
            statements.push([
                `INSERT INTO advertisement_advertiser.advertisement_attribute
                 (advertisement_attribute_guid,
                  advertisement_guid,
                  attribute_type_guid,
                  object_guid,
                  object_key,
                  value)
                 VALUES (?, ?, ?, ?, ?, ?);`,
                attribute.attribute_guid,
                guid,
                this.normalizationRepository.get(attribute.attribute_type),
                this.normalizationRepository.get(attribute.object),
                attribute.object_key,
                attribute.value
            ]);
        });

        return this.database.runBatchAsync(statements)
                   .then(() => ({
                       advertisement_guid      : guid,
                       advertisement_type      : type,
                       advertisement_category  : category,
                       advertisement_name      : name,
                       advertisement_url       : url,
                       protocol_address_funding: fundingAddress,
                       budget_daily_usd        : budgetUSD,
                       budget_daily_mlx        : budgetMLX,
                       bid_impression_usd      : bidImpressionUSD,
                       bid_impression_mlx      : bidImpressionMLX,
                       expiration,
                       attributes
                   }));
    }

    logAdvertisementClick(guid, requestGUID, consumerGUID, protocolAddressKeyIdentifier, ipAddress, expiration) {
        return new Promise((resolve, reject) => {
            this.database.run(`INSERT INTO advertisement_advertiser.advertisement_click_log
                               (log_guid, advertisement_guid,
                                advertisement_request_guid,
                                tangled_guid_consumer,
                                protocol_address_key_identifier,
                                ip_address_consumer, expiration)
                               VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                Database.generateID(32),
                guid,
                requestGUID,
                consumerGUID,
                protocolAddressKeyIdentifier,
                ipAddress,
                expiration
            ], (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }


    getAdvertisement(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_advertiser.advertisement', where);
            this.database.get(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }

    getAdvertisementList(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_advertiser.advertisement', where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }

    getAdvertisementRequestLog(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_advertiser.advertisement_request_log', where);
            this.database.get(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }

    listAdvertisementLedger(where, limit) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_advertiser.advertisement_ledger', where, undefined, limit);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }

    listAdvertisementLedgerMissingPayment(limit) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_ledger l JOIN advertisement_request_log r USING (advertisement_guid, advertisement_request_guid) WHERE l.tx_address_deposit_vout_md5 is NULL AND r.status = 1', undefined, undefined, limit);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }

    getAdvertisementLedger(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_ledger l INNER JOIN advertisement_ledger_attribute a on l.ledger_guid = a.ledger_guid', where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }

                if (!data || data.length === 0) {
                    return resolve();
                }

                const advertisementLedgerData         = _.pick(data[0], [
                    'ledger_id',
                    'ledger_guid',
                    'ledger_guid_pair',
                    'advertisement_guid',
                    'advertisement_request_guid',
                    'transaction_type_guid',
                    'tx_address_deposit_vout_md5',
                    'currency_guid',
                    'deposit',
                    'withdrawal',
                    'price_usd',
                    'status',
                    'create_date'
                ]);
                advertisementLedgerData['attributes'] = [];
                data.forEach(row => {
                    advertisementLedgerData.attributes.push(_.pick(row, [
                        'ledger_attribute_id',
                        'ledger_attribute_guid',
                        'ledger_guid',
                        'attribute_type_guid',
                        'object_guid',
                        'object_key',
                        'value',
                        'status',
                        'create_date'
                    ]));
                });

                resolve(advertisementLedgerData);
            });
        });
    }

    addAdvertisementPayment(advertisementGUID, requestGUID, mlxAmount, transactionType, attributes = []) {
        const ledgerGUID          = Database.generateID(32);
        const ledgerPairGUID      = Database.generateID(32);
        const transactionTypeGUID = this.normalizationRepository.get(transactionType);
        const mlxCurrencyGUID     = this.normalizationRepository.get('mlx');
        const usdAmount           = (mlxAmount / config.MILLIX_USD_VALUE).toFixed(2);

        const statements = [
            [ // payment sent to consumer
                `INSERT INTO advertisement_advertiser.advertisement_ledger
                 (ledger_guid,
                  advertisement_guid,
                  advertisement_request_guid,
                  transaction_type_guid,
                  tx_address_deposit_vout_md5,
                  currency_guid,
                  withdrawal,
                  price_usd)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                `,
                ledgerGUID,
                advertisementGUID,
                requestGUID,
                transactionTypeGUID,
                null,
                mlxCurrencyGUID,
                mlxAmount,
                usdAmount
            ]
        ];

        attributes.forEach(attribute => {
            statements.push([
                `INSERT INTO advertisement_advertiser.advertisement_ledger_attribute
                 (ledger_attribute_guid,
                  ledger_guid,
                  attribute_type_guid,
                  object_guid,
                  object_key,
                  value)
                 VALUES (?, ?, ?, ?, ?, ?);`,
                Database.generateID(32),
                ledgerGUID,
                this.normalizationRepository.get(attribute.attribute_type),
                this.normalizationRepository.get(attribute.object),
                attribute.object_key,
                attribute.value
            ]);
        });

        return this.database.runBatchAsync(statements)
                   .then(() => ({
                       ledger_guid               : ledgerGUID,
                       ledger_guid_pair          : ledgerPairGUID,
                       advertisement_guid        : advertisementGUID,
                       advertisement_request_guid: requestGUID,
                       attributes
                   }));
    }

    updateAdvertisementLedgerWithPayment(transaction, advertisementLedgerOutputList) {
        const statements                          = [];
        const data                                = [];
        const feeOutput                           = _.find(transaction.transaction_output_list, {output_position: -1});
        const feeAddress                          = `${feeOutput.address_base}${feeOutput.address_version}${feeOutput.address_key_identifier}`;
        const feeTransactionAddressDepositVOutMd5 = objectHash.getMD5Buffer(`${transaction.transaction_id}${feeAddress}${feeOutput.output_position}${feeOutput.amount}`).toString('hex');
        const feeLedgerGUID                       = Database.generateID(32);
        const pairLedgerGUID                      = Database.generateID(32);
        const feeTransactionTypeGUID              = this.normalizationRepository.get('expense:operation:protocol fee');
        const mlxCurrencyGUID                     = this.normalizationRepository.get('mlx');
        const feeMLXAmount                        = feeOutput.amount;
        const feeUSDAmount                        = feeMLXAmount / config.MILLIX_USD_VALUE;

        advertisementLedgerOutputList.forEach((advertisementLedgerOutput, outputPosition) => {
            const address                          = `${advertisementLedgerOutput.output.address_base}${advertisementLedgerOutput.output.address_version}${advertisementLedgerOutput.output.address_key_identifier}`;
            const transactionAddressDepositVOutMd5 = objectHash.getMD5Buffer(`${transaction.transaction_id}${address}${outputPosition}${advertisementLedgerOutput.output.amount}`).toString('hex');
            data.push({
                advertisement_request_guid : advertisementLedgerOutput.advertisement_ledger.advertisement_request_guid,
                advertisement_guid         : advertisementLedgerOutput.advertisement_ledger.advertisement_guid,
                protocol_address_hash      : address,
                protocol_transaction_id    : transaction.transaction_id,
                protocol_output_position   : outputPosition,
                tx_address_deposit_vout_md5: transactionAddressDepositVOutMd5,
                deposit                    : advertisementLedgerOutput.advertisement_ledger.withdrawal,
                price_usd                  : advertisementLedgerOutput.advertisement_ledger.price_usd
            });
            statements.push(
                [
                    `UPDATE advertisement_advertiser.advertisement_ledger
                     SET tx_address_deposit_vout_md5 = ?,
                         ledger_guid_pair            = ?
                     WHERE ledger_guid = ?`,
                    transactionAddressDepositVOutMd5,
                    pairLedgerGUID,
                    advertisementLedgerOutput.advertisement_ledger.ledger_guid
                ],
                [
                    `INSERT INTO advertisement_advertiser.advertisement_ledger_attribute
                     (ledger_attribute_guid,
                      ledger_guid,
                      attribute_type_guid,
                      value)
                     VALUES (?, ?, ?, ?);`,
                    Database.generateID(32),
                    advertisementLedgerOutput.advertisement_ledger.ledger_guid,
                    this.normalizationRepository.get('protocol_transaction_id'),
                    transaction.transaction_id
                ],
                [
                    `INSERT INTO advertisement_advertiser.advertisement_ledger_attribute
                     (ledger_attribute_guid,
                      ledger_guid,
                      attribute_type_guid,
                      value)
                     VALUES (?, ?, ?, ?);`,
                    Database.generateID(32),
                    advertisementLedgerOutput.advertisement_ledger.ledger_guid,
                    this.normalizationRepository.get('protocol_output_position'),
                    outputPosition
                ]);
        });

        statements.push([ // payment fee
                `INSERT INTO advertisement_advertiser.advertisement_ledger
                 (ledger_guid,
                  ledger_guid_pair,
                  advertisement_guid,
                  advertisement_request_guid,
                  transaction_type_guid,
                  tx_address_deposit_vout_md5,
                  currency_guid,
                  withdrawal,
                  price_usd)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                `,
                feeLedgerGUID,
                pairLedgerGUID,
                null,
                null,
                feeTransactionTypeGUID,
                feeTransactionAddressDepositVOutMd5,
                mlxCurrencyGUID,
                feeMLXAmount,
                feeUSDAmount
            ],
            [
                `INSERT INTO advertisement_advertiser.advertisement_ledger_attribute
                 (ledger_attribute_guid,
                  ledger_guid,
                  attribute_type_guid,
                  value)
                 VALUES (?, ?, ?, ?);`,
                Database.generateID(32),
                feeLedgerGUID,
                this.normalizationRepository.get('protocol_transaction_id'),
                transaction.transaction_id
            ],
            [
                `INSERT INTO advertisement_advertiser.advertisement_ledger_attribute
                 (ledger_attribute_guid,
                  ledger_guid,
                  attribute_type_guid,
                  value)
                 VALUES (?, ?, ?, ?);`,
                Database.generateID(32),
                feeLedgerGUID,
                this.normalizationRepository.get('protocol_output_position'),
                -1
            ]);

        return this.database.runBatchAsync(statements)
                   .then(() => data);
    }

    addAdvertisementLedgerAttributes(ledgerGUID, attributes) {
        const statements = [];

        attributes.forEach(attribute => {
            statements.push([
                `INSERT INTO advertisement_advertiser.advertisement_ledger_attribute
                 (ledger_attribute_guid,
                  ledger_guid,
                  attribute_type_guid,
                  object_guid,
                  object_key,
                  value)
                 VALUES (?, ?, ?, ?, ?, ?);`,
                Database.generateID(32),
                ledgerGUID,
                this.normalizationRepository.get(attribute.attribute_type),
                this.normalizationRepository.get(attribute.object),
                attribute.object_key,
                attribute.value
            ]);
        });

        return this.database.runBatchAsync(statements)
                   .then(() => ({
                       ledger_guid: ledgerGUID,
                       attributes
                   }));
    }


    pruneAdvertisementRequestWithNoPaymentRequestQueue(timestamp) {
        // TODO: improve this sql statement
        return new Promise((resolve, reject) => {
            this.database.run(`DELETE
                               FROM advertisement_advertiser.advertisement_request_log AS r
                               WHERE status = 1
                                 AND create_date <= ?
                                 AND NOT EXISTS(SELECT ledger_id
                                                FROM advertisement_advertiser.advertisement_ledger
                                                WHERE advertisement_request_guid =
                                                      r.advertisement_request_guid
                                                  AND advertisement_guid = r.advertisement_guid)`, [timestamp], (err) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

                resolve();
            });
        });
    }

    resetAd(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildUpdate('UPDATE advertisement_advertiser.advertisement_request_log', {status: 0}, where);
            this.database.run(sql, parameters, (err) => {
                if (err) {
                    console.log('[database] error', err);
                    return reject(err);
                }

                resolve();
            });
        });
    }

    getThrottledIpAddresses(maxAdvertisementByIpAddress) {
        return new Promise((resolve, reject) => {
            this.database.all(`select distinct ip_address_consumer
                               from advertisement_request_log
                               where status = 1
                               group by advertisement_guid, ip_address_consumer
                               having count(1) >= ?`,
                [maxAdvertisementByIpAddress],
                (err, data) => {
                    if (err) {
                        console.log('[database] error', err);
                        return reject(err);
                    }

                    resolve(data);
                });
        });
    }

    getAdvertisementCountByIpAddress(ipAddress) {
        return new Promise((resolve, reject) => {
            this.database.get(`select max(ad_count) as ad_count
                               from (select count(1) as ad_count
                                     from advertisement_request_log
                                     where status = 1
                                       and ip_address_consumer = ?
                                     group by advertisement_guid)`,
                [ipAddress],
                (err, data) => {
                    if (err) {
                        console.log('[database] error', err);
                        return reject(err);
                    }

                    resolve(data.ad_count);
                });
        });
    }
}
