import {Database} from '../database';
import _ from 'lodash';

export default class Keychain {
    constructor(database) {
        this.database                = database;
    }

    _processAddressList(rows) {
        let addresses = {};
        rows.forEach(row => {
            let address = addresses[row.address];
            if (!address) {
                address                = _.pick(row, 'wallet_id', 'address', 'address_base', 'address_version', 'address_key_identifier', 'address_position', 'is_change', 'status', 'create_date');
                addresses[row.address] = address;
            }

            if (row.attribute_type) {
                if (!address.address_attribute) {
                    address['address_attribute'] = {};
                }
                address['address_attribute'][row.attribute_type] = row.attribute_value;
            }
        });
        return _.values(addresses);
    }

    getWalletDefaultKeyIdentifier(walletID) {
        return new Promise(resolve => {
            this.database.get('SELECT address_base as address_key_identifier FROM millix.keychain WHERE wallet_id = ? AND is_change=0 AND address_position=0', [walletID], (err, row) => {
                return resolve(row ? row.address_key_identifier : null);
            });
        });
    }

    getWalletAddresses(walletID) {
        return new Promise((resolve, reject) => {
            this.database.all(
                'SELECT ka.address, ka.address_base, ka.address_version, ka.address_key_identifier, k.wallet_id, k.address_position, k.is_change, k.create_date, atp.attribute_type, at.value as attribute_value \
                 FROM millix.keychain as k INNER JOIN millix.keychain_address as ka ON k.address_base = ka.address_base \
                 LEFT JOIN millix.address_attribute AS at ON at.address_base = k.address_base \
                 LEFT JOIN millix.address_attribute_type as atp ON atp.address_attribute_type_id = at.address_attribute_type_id \
                 WHERE k.wallet_id = ?', [walletID],
                (err, rows) => {
                    if (err) {
                        console.log(err);
                        return reject(err);
                    }

                    resolve(this._processAddressList(rows));
                }
            );
        });
    }

    listWalletAddresses(where, orderBy, limit) {
        return new Promise((resolve, reject) => {
            const {sql, parameters} = Database.buildQuery('SELECT ka.address, ka.address_base, ka.address_version, ka.address_key_identifier, k.wallet_id, k.address_position, k.is_change, ka.status, ka.create_date, atp.attribute_type, at.value as attribute_value \
                 FROM millix.keychain as k INNER JOIN millix.keychain_address as ka ON k.address_base = ka.address_base \
                 LEFT JOIN millix.address_attribute AS at ON at.address_base = k.address_base \
                 LEFT JOIN millix.address_attribute_type as atp ON atp.address_attribute_type_id = at.address_attribute_type_id', where, 'ka.' + orderBy, limit);
            this.database.all(
                sql, parameters,
                (err, rows) => {
                    if (err) {
                        console.log(err);
                        return reject(err);
                    }

                    resolve(this._processAddressList(rows));
                }
            );
        });
    }

}
