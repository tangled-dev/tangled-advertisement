import Endpoint from '../endpoint';
import database, {Database} from '../../database/database';
import _ from 'lodash';
import config, {MILLIX_USD_VALUE} from '../../config/config';


/**
 * api advertisement_create_random
 */
class _nrfuxmNtoxcec3KS extends Endpoint {
    constructor() {
        super('nrfuxmNtoxcec3KS');
        this.protocolAddressKeyIdentifier = null;
    }

    /**
     * creates and returns a random advertisement
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
            const advertiserRepository      = database.getRepository('advertiser');
            const advertisementTypes        = [
                'text_headline',
                'text_headline_deck',
                'banner_300x50',
                'banner_728x90'
            ];
            const advertisementCategories   = [
                'automotive',
                'automotive - insurance',
                'automotive - loan',
                'travel',
                'coupons',
                'drug & alcohol',
                'education',
                'entertainment',
                'entertainment - gaming',
                'food & beverage',
                'finance',
                'finance - credit card',
                'finance - loan',
                'finance - cryptocurrency',
                'fashion',
                'fashion - men',
                'fashion - women',
                'fashion - children',
                'health',
                'health - weight loss',
                'health - fitness',
                'home',
                'home - decoration',
                'home - insurance',
                'home - loan',
                'home - rental',
                'pets',
                'relationship',
                'relationship - women seeking men',
                'relationship - men seeking women',
                'technology',
                'technology - phone',
                'technology - service'
            ];
            const advertisementGUID         = Database.generateID(32);
            const advertisementType         = _.sample(advertisementTypes);
            const advertisementCategory     = _.sample(advertisementCategories);
            const url                       = `https://www.${Database.generateID(32)}.com`;
            const name                      = `${advertisementCategory} - ${url}`;
            const fundingAddress            = `${this.protocolAddressKeyIdentifier}0a0${this.protocolAddressKeyIdentifier}`;
            const budgetUSD                 = Math.floor(Math.max(100, Math.random() * 1000));
            const budgetMLX                 = Math.floor(budgetUSD * config.MILLIX_USD_VALUE);
            const bidImpressionUSD          = Math.max(0.1, Math.random()).toFixed(2);
            const bidImpressionMLX          = Math.floor(bidImpressionUSD * config.MILLIX_USD_VALUE);
            const expiration                = Math.floor(Math.random() * 10) * 86400;
            const headLineAttributeGUID     = Database.generateID(32);
            const targetPhraseAttributeGUID = Database.generateID(32);
            const targetLanguageUID         = Database.generateID(32);
            const advertisementAttributes   = [
                {
                    attribute_guid: headLineAttributeGUID,
                    attribute_type: 'advertisement_headline',
                    object        : undefined,
                    object_key    : undefined,
                    value         : `the great headline [${headLineAttributeGUID}]`
                },
                {
                    attribute_guid: targetPhraseAttributeGUID,
                    attribute_type: 'target_phrase',
                    object        : 'target phrase',
                    object_key    : undefined,
                    value         : `the target phrase [${targetPhraseAttributeGUID}]`
                },
                {
                    attribute_guid: targetLanguageUID,
                    attribute_type: 'target_language',
                    object        : 'language',
                    object_key    : undefined,
                    value         : 'en-US'
                }
            ];
            advertiserRepository.createAdvertisement(
                advertisementGUID, advertisementType, advertisementCategory,
                name, url, fundingAddress, budgetUSD, budgetMLX,
                bidImpressionUSD, bidImpressionMLX, expiration, advertisementAttributes
            ).then(advertisement => res.send(advertisement));
        });
    }
}


export default new _nrfuxmNtoxcec3KS();
