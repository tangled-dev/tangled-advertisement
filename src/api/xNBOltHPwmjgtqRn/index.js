import Endpoint from '../endpoint';
import database from '../../database/database';


/**
 * api register_ad_network_publisher
 */

class _xNBOltHPwmjgtqRn extends Endpoint {
    constructor() {
        super('xNBOltHPwmjgtqRn');
    }

    /**
     * returns the registered ad network publisher
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        try {
            const {
                      p0: publisherGuid,
                      p1: publisherName,
                      p2: publisherDomain,
                      p3: addressHash,
                      p4: addressKeyPublic
                  }                    = req.query;
            const consumerRepository = database.getRepository('consumer');
            consumerRepository.addAdvertisementNetworkPublisher(
                publisherGuid,
                publisherName,
                publisherDomain,
                addressHash,
                addressKeyPublic
            ).then(() => {
                return consumerRepository.getAdvertisementNetworkPublisher({publisher_guid: publisherGuid});
            }).then((advertisementNetworkPublisher) => {
                res.send(advertisementNetworkPublisher);
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


export default new _xNBOltHPwmjgtqRn();
