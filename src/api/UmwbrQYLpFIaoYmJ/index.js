import Endpoint from '../endpoint';
import database from '../../database/database';


/**
 * api register_ad_network
 */

class _UmwbrQYLpFIaoYmJ extends Endpoint {
    constructor() {
        super('UmwbrQYLpFIaoYmJ');
    }

    /**
     * returns the registered ad network
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        try {
            const {
                      p0: networkGuid,
                      p1: networkName,
                      p2: networkDomain,
                      p3: budgetDailyUSD,
                      p4: budgetDailyMLX,
                      p5: addressHash,
                      p6: addressKeyPublic
                  }                    = req.query;
            const advertiserRepository = database.getRepository('advertiser');
            advertiserRepository.addAdvertisementNetwork(
                networkGuid,
                networkName,
                networkDomain,
                budgetDailyUSD,
                budgetDailyMLX,
                addressHash,
                addressKeyPublic
            ).then(() => {
                return advertiserRepository.getAdvertisementNetwork({network_guid: networkGuid});
            }).then((advertisementNetwork) => {
                res.send(advertisementNetwork);
            }).catch((e) => res.status(400).send({
                api_status : 'fail',
                api_message: `${e?.message | e}`
            }));
        }
        catch (e) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `p0 is not a valid JSON: ${e}`
            });
        }
    }
}


export default new _UmwbrQYLpFIaoYmJ();
