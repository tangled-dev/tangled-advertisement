import {Database} from '../database';

export default class Language {
    constructor(database) {
        this.database = database;
    }

    listLanguage(where) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM language', where);
            this.database.all(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err.message);
                }

                if (data.length === 0) {
                    return resolve(data);
                }

                const languages = {};

                data.forEach(language => {
                    languages[language.language_guid] = {
                        ...language
                    };
                });

                resolve(_.values(languages));
            });
        });
    }

    getLanguageByGuid(language_guid) {
        return new Promise((resolve, reject) => {
            const {
                      sql,
                      parameters
                  } = Database.buildQuery('SELECT * FROM language', {language_guid: language_guid});
            this.database.get(sql, parameters, (err, data) => {
                if (err) {
                    return reject(err.message);
                }

                if (data.length === 0) {
                    return resolve(data);
                }

                resolve(data);
            });
        });
    }
}
