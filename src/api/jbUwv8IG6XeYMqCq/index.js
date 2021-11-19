import Endpoint from '../endpoint';
import database from '../../database/database';


/**
 * api get_ad_types
 */

class _jbUwv8IG6XeYMqCq extends Endpoint {
    constructor() {
        super('jbUwv8IG6XeYMqCq');
    }

    handler(app, req, res) {
        const advertiserRepository = database.getRepository('advertiser');
        advertiserRepository.listAdvertisementType({})
                            .then(types => res.send(types))
                            .catch(e => res.send({
                                api_status : 'fail',
                                api_message: `unexpected generic api error: (${e})`
                            }));
    }

}


export default new _jbUwv8IG6XeYMqCq();
