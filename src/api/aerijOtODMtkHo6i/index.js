import Endpoint from '../endpoint';
import database from '../../database/database';
import peer from '../../network/peer';


/**
 * api list_ad
 */

class _aerijOtODMtkHo6i extends Endpoint {
    constructor() {
        super('aerijOtODMtkHo6i');
    }

    /**
     * returns list of ads by given
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {

        if (peer.protocolAddressKeyIdentifier === null) {
            return res.send({
                api_status : 'fail',
                api_message: `unexpected generic api error: (wallet not loaded)`
            });
        }

        let pipeline = Promise.resolve();
        pipeline.then(() => {
            const advertiserRepository = database.getRepository('advertiser');
            const fundingAddress       = `${peer.protocolAddressKeyIdentifier}0a0${peer.protocolAddressKeyIdentifier}`;
            return advertiserRepository.getAdvertisementByProtocolAddressFunding(fundingAddress).then(advertisement => res.send({
                    api_status        : 'ok',
                    api_message       : 'fetch successfull',
                    advertisement_list: advertisement
                }
            ));
        }).catch(e => res.send({
            api_status : 'fail',
            api_message: `unexpected generic api error: (${e})`
        }));
    }
}


export default new _aerijOtODMtkHo6i();
