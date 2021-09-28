import {Database} from '../database';

export default class Consumer {
    constructor(database) {
        this.database = database;
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
                this.database.all(`SELECT * FROM advertisement_consumer.advertisement_attribute
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
}
