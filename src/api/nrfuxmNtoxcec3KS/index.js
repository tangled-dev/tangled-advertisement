import Endpoint from '../endpoint';
import database, {Database} from '../../database/database';
import _ from 'lodash';
import config from '../../config/config';
import peer from '../../network/peer';


/**
 * api advertisement_create_random
 */
class _nrfuxmNtoxcec3KS extends Endpoint {
    constructor() {
        super('nrfuxmNtoxcec3KS');
    }

    /**
     * creates and returns a random advertisement
     * @param app
     * @param req
     * @param res
     */
    handler(app, req, res) {
        if (!config.MODE_TEST) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `api not enabled: random advertisements cannot be created when mode_test is ${config.MODE_TEST}`
            });
        }

        if (peer.protocolAddressKeyIdentifier === null) {
            return res.send({
                api_status : 'fail',
                api_message: `unexpected generic api error: (wallet not loaded)`
            });
        }

        let pipeline = Promise.resolve();
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
            const fundingAddress            = `${peer.protocolAddressKeyIdentifier}0a0${peer.protocolAddressKeyIdentifier}`;
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
