import Endpoint from '../endpoint';
import database, {Database} from '../../database/database';
import _ from 'lodash';


/**
 * api log_advertisement_click
 */
class _JPMvLLnqBYtadpH2 extends Endpoint {
    constructor() {
        super('JPMvLLnqBYtadpH2');
    }

    /**
     * logs a click on a specific advertisement
     * @param app
     * @param req (p0: advertisement_guid<required>, p1:
     *     advertisement_request_guid<required>, p2:
     *     tangled_guid_consumer<required>, p3:
     *     protocol_address_key_identifier<required>)
     * @param res
     */
    handler(app, req, res) {
        const {
                  p0: guid,
                  p1: requestGUID,
                  p2: consumerGUID,
                  p3: protocolAddressKeyIdentifier
              } = req.query;

        if (!guid || !requestGUID || !consumerGUID || !protocolAddressKeyIdentifier) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: 'p0<advertisement_guid>, p1<advertisement_request_guid>, p2<tangled_guid_consumer>, p3<protocol_address_key_identifier>, are required'
            });
        }

        const advertiserRepository = database.getRepository('advertiser');
        const ipAddress            = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        advertiserRepository.getAdvertisement({
            advertisement_guid: guid
        }).then(advertisement => advertiserRepository.getAdvertisementRequestLog({
            tangled_guid_consumer     : consumerGUID,
            advertisement_guid        : guid,
            advertisement_request_guid: requestGUID
        }).then(advertisementRequest => ([
            advertisement,
            advertisementRequest
        ]))).then(([advertisement, advertisementRequest]) => {
            if (!advertisement) {
                return res.send({
                    api_status : 'fail',
                    api_message: `advertisement not found => advertisement_guid: ${guid}`
                });
            }
            else if (!advertisementRequest) {
                return res.send({
                    api_status : 'fail',
                    api_message: `advertisement request not found => advertisement_guid: ${guid} | tangled_guid_consumer: ${consumerGUID} | advertisement_request_guid: ${requestGUID}`
                });
            }
            return advertiserRepository.logAdvertisementClick(guid, requestGUID, consumerGUID, protocolAddressKeyIdentifier, ipAddress, advertisement.expiration);
        }).then(() => {
            res.send({api_status: 'success'});
        }).catch(e => res.send({
            api_status : 'fail',
            api_message: `unexpected generic api error: (${e})`
        }));
    }
}


export default new _JPMvLLnqBYtadpH2();
