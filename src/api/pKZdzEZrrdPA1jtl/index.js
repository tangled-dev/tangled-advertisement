import Endpoint from '../endpoint';
import database from '../../database/database';
import config from '../../config/config';
import peer from '../../network/peer';


/**
 * api reset_ad
 */

class _pKZdzEZrrdPA1jtl extends Endpoint {
    constructor() {
        super('pKZdzEZrrdPA1jtl');
    }

    /**
     * returns reset add
     * @param app
     * @param req (p0: advertisement_guid<required>)
     * @param res
     */
    handler(app, req, res) {
        const {
                  p0: advertisementGUID
              } = req.query;

        if (!advertisementGUID) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: 'p0<advertisement_guid> is required'
            });
        }

        const timestamp = Math.floor(Date.now() / 1000 - 86400); /* 1 day old */
        const advertiserRepository = database.getRepository('advertiser');
        advertiserRepository.resetAd({
            advertisement_guid: advertisementGUID,
            create_date_max   : timestamp
        })
                            .then(() => {
                                peer.updateThrottledIpAddress();
                                res.send({
                                    api_status : 'success',
                                    api_message: 'ad reset performed'
                                });
                            })
                            .catch(e => res.send({
                                api_status : 'fail',
                                api_message: `unexpected generic api error: (${e})`
                            }));
    }
}


export default new _pKZdzEZrrdPA1jtl();
