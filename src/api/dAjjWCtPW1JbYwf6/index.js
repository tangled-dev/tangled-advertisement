import Endpoint from '../endpoint';
import database, {Database} from '../../database/database';

/**
 * api get_categories_list
 */

class _dAjjWCtPW1JbYwf6 extends Endpoint{
    constructor() {
        super('dAjjWCtPW1JbYwf6');
    }

    /**
     * returns the list of advertiser categories
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        const advertiserRepository = database.getRepository('advertiser');
        advertiserRepository.listCategory({})
            .then(categories => res.send(categories))
            .catch(e => res.send({
                api_status : 'fail',
                api_message: `unexpected generic api error: (${e})`
            }));  ;
    }
}

export default new _dAjjWCtPW1JbYwf6();
