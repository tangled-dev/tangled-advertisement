import Endpoint from '../endpoint';
import database from '../../database/database';


/**
 * api list_ad
 */

class _aerijOtODMtkHo6i extends Endpoint {
    constructor() {
        super('aerijOtODMtkHo6i');
        this.protocolAddressKeyIdentifier = null;
    }

    /**
     * returns list of ads by given
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        let pipeline = Promise.resolve();

        if (this.protocolAddressKeyIdentifier === null) {
            const walletRepository   = database.getRepository('wallet');
            const keychainRepository = database.getRepository('keychain');
            pipeline                 = pipeline.then(() => walletRepository.getWallet())
                                               .then(wallet => keychainRepository.getWalletDefaultKeyIdentifier(wallet.wallet_id))
                                               .then(addressKeyIdentifier => this.protocolAddressKeyIdentifier = addressKeyIdentifier);
        }

        pipeline.then(() => {
            const advertiserRepository = database.getRepository('advertiser');
            const fundingAddress       = `${this.protocolAddressKeyIdentifier}0a0${this.protocolAddressKeyIdentifier}`;
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
