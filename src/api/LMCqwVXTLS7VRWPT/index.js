import Endpoint from '../endpoint';
import database, {Database} from '../../database/database';
import _ from 'lodash';


/**
 * api get_next_consumer_advertisement_render
 */
class _LMCqwVXTLS7VRWPT extends Endpoint {
    constructor() {
        super('LMCqwVXTLS7VRWPT');
    }

    /**
     * returns the advertisement that should be rendered
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        const consumerRepository = database.getRepository('consumer');
        consumerRepository.listAdvertisement({})
            .then(advertisements => res.send(_.sample(advertisements)));
    }
}


export default new _LMCqwVXTLS7VRWPT();
