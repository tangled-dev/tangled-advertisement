import {Database} from '../database';

export default class ConsumerAttribute {
    constructor(database, normalizationRepository) {
        this.database                = database;
        this.normalizationRepository = normalizationRepository;
    }

    setNormalizationRepository(repository) {
        this.normalizationRepository = repository;
    }

    getAttributeList(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM advertisement_consumer.advertisement_attribute', where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err);
                }

                data.map(attribute => {
                    attribute.attribute_type = this.normalizationRepository.getType(attribute.attribute_type_guid);
                    attribute.object         = this.normalizationRepository.getType(attribute.object_guid);
                });
                resolve(data);
            });
        });
    }
}
