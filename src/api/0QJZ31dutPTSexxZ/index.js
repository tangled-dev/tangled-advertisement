import Endpoint from '../endpoint';
import config from "../../config/config";


/**
 * api api_version
 */
class _0QJZ31dutPTSexxZ extends Endpoint {
    constructor() {
        super('0QJZ31dutPTSexxZ');
    }

    /**
     * returns the api version
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        res.send({
            name: config.NAME,
            version: config.VERSION
        });
    }
}


export default new _0QJZ31dutPTSexxZ();
