import Endpoint from '../endpoint';
import database from '../../database/database';
import peer from '../../network/peer';


/**
 * api get_advertisement_consumer_settlement_ledger_list
 */

class _B1Gg7nMljx0yX9z9 extends Endpoint {
    constructor() {
        super('B1Gg7nMljx0yX9z9');
    }

    /**
     * returns advertisement_consumer_settlement_ledger_list
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        if (peer.protocolAddressKeyIdentifier === null) {
            return res.send({
                api_status : 'fail',
                api_message: `unexpected generic api error: (wallet not loaded)`
            });
        }

        const {
                  p0: from_unix_date
              } = req.query;

        let pipeline = Promise.resolve();
        pipeline.then(() => {
            const advertiserRepository = database.getRepository('consumer');
            return advertiserRepository.getAdvertisementWithSettlementLedgerList({payment_date_min: from_unix_date}).then(ledger_list => {
                if (ledger_list) {
                    const result_ledger_list = {};
                    ledger_list.map(item_ledger => {
                        result_ledger_list[item_ledger.advertisement_guid]                = item_ledger;
                        result_ledger_list[item_ledger.advertisement_guid].attribute_list = [];
                    });

                    let result_advertisement_guid   = _.keys(result_ledger_list);
                    let consumerAttributeRepository = database.getRepository('consumer_attribute');
                    consumerAttributeRepository.getAttributeList({'advertisement_guid_in': result_advertisement_guid}).then(advertisement_attribute_list => {
                        advertisement_attribute_list.forEach(attribute => {
                            result_ledger_list[attribute.advertisement_guid].attribute_list.push({
                                attribute_guid: attribute.advertisement_attribute_guid,
                                attribute_type: attribute.attribute_type,
                                object        : attribute.object,
                                value         : attribute.value
                            });

                            result_ledger_list[attribute.advertisement_guid][attribute.attribute_type] = attribute.value;
                        });

                        res.send({
                            api_status : 'success',
                            ledger_list: _.values(result_ledger_list)
                        });
                    }).catch(e => res.send({
                        api_status : 'fail',
                        api_message: `unexpected generic api error: (${e})`
                    }));
                }
                else {
                    res.send({
                        api_status : 'success',
                        api_message: `advertisement not found`
                    });
                }
            });

        }).catch(e => res.send({
            api_status : 'fail',
            api_message: `unexpected generic api error: (${e})`
        }));
    }
}


export default new _B1Gg7nMljx0yX9z9();
