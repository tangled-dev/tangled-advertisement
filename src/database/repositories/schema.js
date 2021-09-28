import Migration from '../migration/migration';
import {Database} from '../database';
export default class Schema {
    constructor(database) {
        this.database    = database;
        this.baseMigrate = new Migration();
    }

    getVersion() {
        return new Promise((resolve, reject) => {
            this.database.get('SELECT value FROM schema_information WHERE key="version"', (err, row) => {
                if (err) {
                    return reject(err);
                }
                resolve(row.value);
            });
        });
    }

    get(where) {
        const {
                  sql,
                  parameters
              } = Database.buildQuery('SELECT * FROM schema_information', where);
        return new Promise((resolve, reject) => {
            this.database.get(sql, parameters, (err, rows) => {
                if (err) {
                    return reject(err);
                }
                resolve(rows);
            });
        });
    }

    migrate(version, migrationDir) {
        const data = require('../migration/schema-update-' + version + '.sql');
        try {
            const module = require('../migration/schema-update-' + version + '.js');
            return module.default.migrate(this.database, data);
        }
        catch (e) {
            return this.baseMigrate.runMigrateScript(this.database, data);
        }

    }
}
