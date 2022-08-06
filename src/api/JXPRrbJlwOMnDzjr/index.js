import Endpoint from '../endpoint';
import database from '../../database/database';


/**
 * api get_total_ad_payment
 */

class _JXPRrbJlwOMnDzjr extends Endpoint {
    constructor() {
        super('JXPRrbJlwOMnDzjr');
    }

    /**
     * returns the total ad payment (p0: start_timestamp)
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        const consumerRepository = database.getRepository('consumer');
        consumerRepository.getTotalAdvertisementPayment({'payment_received_date_min': req.query.p0 || (Math.floor(Date.now() / 1000) - 86400)})
                          .then(total => res.send({total}))
                          .catch(e => res.send({
                              api_status : 'fail',
                              api_message: `unexpected generic api error: (${e})`
                          }));
    }
}


export default new _JXPRrbJlwOMnDzjr();
