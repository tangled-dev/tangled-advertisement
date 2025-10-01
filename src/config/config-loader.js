import db from '../database/database';
import config from './config';
import _ from 'lodash';
import async from 'async';
import path from 'path';
import os from 'os';


class _ConfigLoader {
    constructor() {
        this.reservedConfigNameList = new Set([
            'DATABASE_CONNECTION',
            'TRANSACTION_OUTPUT_MAX',
            'NODE_INITIAL_LIST',
        ]);
    }

    cleanConfigsFromDatabase() {
        return db.getRepository('config')
                 .deleteAll();
    }

    load(overwriteDefaultConfigsFromDatabase = true) {
        return new Promise(resolve => {
            let dbConfigs = {
                config: {},
                type  : {}
            };
            async.eachSeries(_.keys(config), (configName, callback) => {
                if (configName === 'default' || this.reservedConfigNameList.has(configName)) {
                    dbConfigs.config[configName] = config[configName];
                    dbConfigs.type[configName]   = 'object';
                    callback();
                }
                else {
                    db.getRepository('config')
                      .getConfig(configName)
                      .then(data => {
                          if (data) {
                              let value;
                              switch (data.type) {
                                  case 'string':
                                      value = data.value;
                                      break;
                                  default:
                                      value = JSON.parse(data.value);
                              }
                              if (overwriteDefaultConfigsFromDatabase) {
                                  config[configName] = value;
                              }

                              dbConfigs.config[configName] = value;
                              dbConfigs.type[configName]   = data.type;
                              callback();
                          }
                          else {
                              let value = config[configName];
                              let type  = typeof value;

                              dbConfigs.config[configName] = value;
                              dbConfigs.type[configName]   = type;

                              if (type !== 'string') {
                                  value = JSON.stringify(value);
                              }

                              db.getRepository('config')
                                .addConfig(configName, value, type)
                                .then(() => callback())
                                .catch(() => callback());
                          }
                      });
                }
            }, () => {
                if (overwriteDefaultConfigsFromDatabase) {
                    const dataFolder                             = path.isAbsolute(config.DATABASE_CONNECTION.FOLDER) ? config.DATABASE_CONNECTION.FOLDER : path.join(os.homedir(), config.DATABASE_CONNECTION.FOLDER);
                    config.DATABASE_CONNECTION.FOLDER            = dataFolder;

                    config.NODE_KEY_PATH                          = path.join(dataFolder, 'node.json');
                    dbConfigs.config['NODE_KEY_PATH']             = config.NODE_KEY_PATH;
                    config.NODE_CERTIFICATE_KEY_PATH              = path.join(dataFolder, 'node_certificate_key.pem');
                    dbConfigs.config['NODE_CERTIFICATE_KEY_PATH'] = config.NODE_CERTIFICATE_KEY_PATH;
                    config.NODE_CERTIFICATE_PATH                  = path.join(dataFolder, 'node_certificate.pem');
                    dbConfigs.config['NODE_CERTIFICATE_PATH']     = config.NODE_CERTIFICATE_PATH;
                }
                resolve(dbConfigs);
            });
        });
    }
}


export default new _ConfigLoader();
