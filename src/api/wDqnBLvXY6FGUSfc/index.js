import Endpoint from '../endpoint';
import database from '../../database/database';


/**
 * api get_languages_list
 */

class _wDqnBLvXY6FGUSfc extends Endpoint {
    constructor() {
        super('wDqnBLvXY6FGUSfc');
    }

    /**
     * returns list of available languages
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        const languageRepository = database.getRepository('language');
        languageRepository.listLanguage({})
                          .then(languages => res.send(languages))
                          .catch(e => res.send({
                              api_status : 'fail',
                              api_message: `unexpected generic api error: (${e})`
                          }));
    }
}


export default new _wDqnBLvXY6FGUSfc();
