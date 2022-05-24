import Endpoint from '../endpoint';
import database from '../../database/database';


/**
 * api toggle_ad_status
 */

class _C7neErVANMWXWuse extends Endpoint {
    constructor() {
        super('C7neErVANMWXWuse');
    }

    handler(app, req, res) {
        let payload;
        try {
            const {
                      p0
                  } = req.query;
            payload = JSON.parse(p0);
        }
        catch (e) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `p0 is not a valid JSON: ${e}`
            });
        }

        if (!payload.advertisement_guid) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `advertisement_guid<advertisement_guid>`
            });
        }
        const advertiserRepository = database.getRepository('advertiser');
        return advertiserRepository.toggleAdvertisementStatus(payload.advertisement_guid)
                                   .then(() => {
                                           advertiserRepository.getAdvertisement({advertisement_guid: payload.advertisement_guid})
                                                               .then(advertisement => res.send({
                                                                   api_status   : 'success',
                                                                   advertisement: advertisement
                                                               }))
                                                               .catch(e => res.send({
                                                                   api_status : 'fail',
                                                                   api_message: `unexpected generic api error: (${e})`
                                                               }));
                                       }
                                   ).catch(e => res.send({
                api_status : 'fail',
                api_message: `unexpected generic api error: (${e})`
            }));
    }
}


export default new _C7neErVANMWXWuse();
