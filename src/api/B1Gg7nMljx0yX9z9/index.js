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
                  p0: fromUnixDate
              } = req.query;

        let pipeline = Promise.resolve();
        pipeline.then(() => {
            const advertiserRepository = database.getRepository('consumer');
            return advertiserRepository.getAdvertisementWithSettlementLedgerList({payment_received_date_min: fromUnixDate}).then(ledgerList => {
                if (ledgerList) {
                    const resultLedgerList      = {};
                    const advertisementItemKeys = {};
                    ledgerList.map(itemLedger => {
                        const key = `${itemLedger.advertisement_guid}_${itemLedger.creative_request_guid}`;
                        if (!advertisementItemKeys[itemLedger.advertisement_guid]) {
                            advertisementItemKeys[itemLedger.advertisement_guid] = [];
                        }
                        advertisementItemKeys[itemLedger.advertisement_guid].push(key);
                        resultLedgerList[key]                = itemLedger;
                        resultLedgerList[key].attribute_list = [];
                    });

                    let resultAdvertisementGuid     = _.keys(advertisementItemKeys);
                    let consumerAttributeRepository = database.getRepository('consumer_attribute');
                    consumerAttributeRepository.getAttributeList({advertisement_guid_in: resultAdvertisementGuid}).then(advertisementAttributeList => {
                        advertisementAttributeList.forEach(attribute => {
                            advertisementItemKeys[attribute.advertisement_guid].forEach(key => {
                                resultLedgerList[key].attribute_list.push({
                                    attribute_guid: attribute.advertisement_attribute_guid,
                                    attribute_type: attribute.attribute_type,
                                    object        : attribute.object,
                                    value         : attribute.value
                                });

                                resultLedgerList[key][attribute.attribute_type] = attribute.value;
                            });
                        });

                        res.send({
                            api_status : 'success',
                            ledger_list: _.values(resultLedgerList)
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
