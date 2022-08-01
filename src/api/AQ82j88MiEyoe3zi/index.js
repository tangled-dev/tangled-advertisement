import Endpoint from '../endpoint';
import database, {Database} from '../../database/database';
import _ from 'lodash';


/**
 * api get_last_advertisement_payment_date
 */
class _AQ82j88MiEyoe3zi extends Endpoint {
    constructor() {
        super('AQ82j88MiEyoe3zi');
    }

    /**
     * returns the timestamp when the last advertisement payment was received
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        const consumerRepository = database.getRepository('consumer');
        consumerRepository.getLastAdvertisementPaymentDate()
            .then(timestamp => res.send({timestamp}));
    }
}


export default new _AQ82j88MiEyoe3zi();
