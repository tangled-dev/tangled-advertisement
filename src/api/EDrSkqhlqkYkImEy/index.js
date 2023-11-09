import Endpoint from '../endpoint';
import database, {Database} from '../../database/database';


/**
 * api register_ad_network_webmaster
 */

class _EDrSkqhlqkYkImEy extends Endpoint {
    constructor() {
        super('EDrSkqhlqkYkImEy');
    }

    /**
     * returns the registered an ad network webmaster
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        try {
            const {
                      p0: webmasterName,
                      p1: webmasterDomain,
                      p2: addressHash,
                      p3: addressKeyPublic,
                      p4: webmasterCallbackURL
                  }                  = req.query;
            const consumerRepository = database.getRepository('consumer');
            const webmasterGUID      = Database.generateID(32);
            consumerRepository.addAdvertisementNetworkWebmaster(
                webmasterGUID,
                webmasterName,
                webmasterDomain,
                addressHash,
                addressKeyPublic,
                webmasterCallbackURL
            ).then(() => {
                return consumerRepository.getAdvertisementNetworkWebmaster({webmaster_name: webmasterName});
            }).then((advertisementNetworkWebmaster) => {
                res.send(advertisementNetworkWebmaster);
            }).catch((e) => res.status(400).send({
                api_status : 'fail',
                api_message: `${e?.message || e}`
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


export default new _EDrSkqhlqkYkImEy();
