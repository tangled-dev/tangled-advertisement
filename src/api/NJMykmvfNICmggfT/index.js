import Endpoint from '../endpoint';
import database from '../../database/database';
import _ from 'lodash';
import {Client} from '../client';
import mutex from '../../core/mutex';


/**
 * api get_random_script_advertisement_network_webmaster
 */

class _NJMykmvfNICmggfT extends Endpoint {
    constructor() {
        super('NJMykmvfNICmggfT');
    }

    /**
     * returns a random advertisement for a script registered as an
     * advertisement network webmaster
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        try {
            const {
                      p0: webmasterGUID,
                      p1: webmasterTargetGUID,
                      p2: webmasterTargetLanguage
                  } = req.query;

            if (!webmasterGUID || !webmasterTargetGUID) {
                return res.status(400).send({
                    api_status : 'fail',
                    api_message: 'p0<webmaster_guid> and p1<webmaster_target_guid> are required'
                });
            }

            const webmasterTargetIpAddress = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown').split(',')[0].trim();
            let refererDomain;
            try {
                refererDomain = new URL(req.headers.referer).hostname;
            }
            catch {
            }

            mutex.lock(['NJMykmvfNICmggfT'], unlock => {
                const consumerRepository = database.getRepository('consumer');
                consumerRepository.getAdvertisementNetworkWebmaster({
                    webmaster_guid: webmasterGUID,
                    status        : 1
                }).then(webmaster => {
                    if (!webmaster) {
                        return Promise.reject({message: 'webmaster_guid_not_found'});
                    }

                    if (refererDomain !== webmaster.webmaster_domain) {
                        return Promise.reject({message: 'strict_domain_request_error'});
                    }

                    const fetchAd = () => {
                        return consumerRepository.getRandomAdvertisementNetworkAdvertisement(
                            webmasterGUID,
                            webmasterTargetGUID,
                            webmasterTargetIpAddress,
                            webmasterTargetLanguage || 'unknown'
                        ).then(advertisement => {
                            if (advertisement.attributes.length === 0) {
                                return consumerRepository.updateAdvertisementNetworkQueue({status: 0}, {advertisement_guid: advertisement.advertisement_guid})
                                                         .then(() => fetchAd())
                                                         .catch(() => fetchAd());
                            }
                            advertisement = _.pick(advertisement, [
                                'advertisement_guid',
                                'advertisement_url',
                                'bid_impression_mlx',
                                'attributes',
                                'webmaster_target_guid',
                                'webmaster_queue_guid'
                            ]);
                            res.send(advertisement);
                            if (!!webmaster.webmaster_callback_url) {
                                Client.sendGet(`${webmaster.webmaster_callback_url}?p1=${JSON.stringify(advertisement)}`)
                                      .then(_ => _)
                                      .catch(_ => _);
                            }
                        });
                    };
                    return fetchAd();
                }).catch((e) => res.status(400).send({
                    api_status : 'fail',
                    api_message: `${e?.message || e}`
                })).then(() => unlock());
            });
        }
        catch (e) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `p0 is not a valid JSON: ${e}`
            });
        }
    }
}


export default new _NJMykmvfNICmggfT();
