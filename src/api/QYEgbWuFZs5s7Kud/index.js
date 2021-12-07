import Endpoint from '../endpoint';
import peer from '../../network/peer';


/**
 * api request_advertisement_payment
 */

class _QYEgbWuFZs5s7Kud extends Endpoint {
    constructor() {
        super('QYEgbWuFZs5s7Kud');
    }

    /**
     * request payment for a new advertisement
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        const {p0: advertisementGUID} = req.query;

        if (!advertisementGUID) {
            return res.status(400).send({
                api_status: 'fail',
                api_message: `advertisement_guid is required`
            });
        }
        peer.requestAdvertisementPayment(advertisementGUID);
        res.send({
            api_status : 'success',
            api_message: 'payment request sent'
        });
    }
}


export default new _QYEgbWuFZs5s7Kud();
