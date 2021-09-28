import {Database} from '../database';

export default class Advertiser {
    constructor(database) {
        this.database                = database;
        this.normalizationRepository = null;
    }

    setNormalizationRepository(repository) {
        this.normalizationRepository = repository;
    }

    getAdvertisement(consumerGUID) {
        return new Promise((resolve, reject) => {
            this.database.all(`SELECT *
                               FROM advertisement_advertiser.advertisement
                               WHERE advertisement_guid NOT IN (
                                   SELECT advertisement_guid
                                   FROM advertisement_advertiser.advertisement_request_log
                                   WHERE tangled_guid_consumer = ?
                               )`, [consumerGUID], (err, data) => {
                if (err) {
                    return reject(err);
                }

                if (data.length === 0) {
                    return resolve(data);
                }
                const advertisements = {};
                data.forEach(advertisement => {
                    advertisements[advertisement.advertisement_guid] = {
                        advertisement_guid         : advertisement.advertisement_guid,
                        advertisement_type         : this.normalizationRepository.getType(advertisement.advertisement_type_guid),
                        advertisement_category_type: this.normalizationRepository.getType(advertisement.advertisement_category_type_guid),
                        advertisement_name         : advertisement.advertisement_name,
                        advertisement_url          : advertisement.advertisement_url,
                        protocol_address_funding   : advertisement.protocol_address_funding,
                        budget_daily_usd           : advertisement.budget_daily_usd,
                        budget_daily_mlx           : advertisement.budget_daily_mlx,
                        bid_impression_usd         : advertisement.bid_impression_usd,
                        bid_impression_mlx         : advertisement.bid_impression_mlx,
                        expiration                 : advertisement.expiration,
                        attributes                 : []
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

    logAdvertisementRequest(guid, consumerGUID, ipAddress, requestGUID, protocolAddressKeyIdentifier, rawRequest) {
        return new Promise((resolve, reject) => {
            this.database.run(`INSERT INTO advertisement_advertiser.advertisement_request_log
                               (log_guid,
                                advertisement_guid,
                                advertisement_request_guid,
                                tangled_guid_consumer,
                                ip_address_consumer,
                                protocol_address_key_identifier,
                                advertisement_request_raw)
                               VALUES (?, ?, ?, ?, ?, ?, ?);`, [
                Database.generateID(32),
                guid,
                requestGUID,
                consumerGUID,
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
                                                                     advertisement_category_type_guid,
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
                       advertisement_guid         : guid,
                       advertisement_type         : type,
                       advertisement_category_type: category,
                       advertisement_name         : name,
                       advertisement_url          : url,
                       protocol_address_funding   : fundingAddress,
                       budget_daily_usd           : budgetUSD,
                       budget_daily_mlx           : budgetMLX,
                       bid_impression_usd         : bidImpressionUSD,
                       bid_impression_mlx         : bidImpressionMLX,
                       expiration,
                       attributes
                   }));
    }
}
