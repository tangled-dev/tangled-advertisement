import {Database} from '../database';
import _ from 'lodash';

export default class Node {
    constructor(database) {
        this.database                = database;
        this.normalizationRepository = null;
    }

    setNormalizationRepository(repository) {
        this.normalizationRepository = repository;
    }

    listNodes(where, orderBy, limit) {
        return new Promise(resolve => {
            let {
                    sql,
                    parameters
                } = Database.buildQuery('SELECT * FROM node', where, orderBy, limit);
            this.database.all(sql, parameters, (err, rows) => {
                resolve(rows);
            });
        });
    }

    getNode(where) {
        return new Promise(resolve => {
            let {
                    sql,
                    parameters
                } = Database.buildQuery('SELECT * FROM node', where);
            this.database.get(sql, parameters, (err, row) => {
                resolve(row);
            });
        });
    }


    addNode(node) {
        let url = node.node_prefix + node.node_address + ':' + node.node_port;
        return new Promise((resolve, reject) => {
            this.database.run('INSERT INTO node (node_prefix, node_address, node_port, node_id, status) VALUES (?,?,?,?,?)', [
                node.node_prefix,
                node.node_address,
                node.node_port,
                node.node_id,
                node.status === undefined ? 1 : node.status
            ], (err) => {
                if (err) {
                    err.message.startsWith('SQLITE_CONSTRAINT') ? console.log(`[database] node ${url} already exits`) : console.error(err.message);
                    if (!node.node_id) {
                        return reject(err.message);
                    }
                    else {
                        const set          = _.pick(node, [
                            'status',
                            'node_prefix',
                            'node_address',
                            'node_port'
                        ]);
                        set['update_date'] = Math.floor(Date.now() / 1000);
                        const {
                                  sql,
                                  parameters
                              }            = Database.buildUpdate('UPDATE node', set, {node_id: node.node_id});
                        this.database.run(sql, parameters, err => {
                            console.log(`[database] update node ${url} with id ${node.node_id}`);
                            return err ? reject() : resolve();
                        });
                        return;
                    }
                }
                resolve();
            });
        });
    }

    updateNode(node) {
        return new Promise(resolve => {
            const set          = _.pick(node, [
                'status',
                'node_prefix',
                'node_address',
                'node_port'
            ]);
            set['update_date'] = Math.floor(Date.now() / 1000);
            const {
                      sql,
                      parameters
                  }            = Database.buildUpdate('UPDATE node', set, {node_id: node.node_id});
            this.database.run(sql, parameters, () => {
                return resolve();
            });
        });
    }

}
