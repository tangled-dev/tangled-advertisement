import Endpoint from '../endpoint';
import database, {Database} from '../../database/database';
import config from '../../config/config';


/**
 * api advertisement_create
 */
class _scWZ0yhuk5hHLd8s extends Endpoint {
    constructor() {
        super('scWZ0yhuk5hHLd8s');
        this.protocolAddressKeyIdentifier = null;
    }

    /**
     * creates ad and returns it content
     * @param app
     * @param req
     * @param res
     * @returns {*}
     */
    handler(app, req, res) {
        let payload;
        try {
            const {
                      p0
                  } = req.query;
            payload = JSON.parse(p0);
        }
        catch (e) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `p0 is not a valid JSON: ${e}`
            });
        }

        if (
            !payload.creative_name ||
            !payload.category ||
            !payload.headline ||
            !payload.deck ||
            !payload.url ||
            !payload.target_language ||
            !payload.search_phrase ||
            !payload.daily_budget_mlx ||
            !payload.bid_per_impressions_mlx
        ) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `creative_name<creative_name>, category<category_guid>, headline<headline>, target_language<language>, deck<deck>, url<url>, search_phrase<search_phrase>, daily_budget_mlx<daily_budget_mlx>, bid_per_impressions_mlx<bid_per_1k_impressions_mlx>`
            });
        }

        const bidPerImpressionMLX = Math.floor(payload.bid_per_impressions_mlx / 1000);
        if (bidPerImpressionMLX > config.ADS_TRANSACTION_AMOUNT_MAX) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `bid_per_impressions_mlx (${payload.bid_per_impressions_mlx}) is greater than the maximum allowed value: max bid per impression is ${config.ADS_TRANSACTION_AMOUNT_MAX}, current value is ${bidPerImpressionMLX}`
            });
        }

        let pipeline = Promise.resolve();
        if (this.protocolAddressKeyIdentifier === null) {
            const walletRepository   = database.getRepository('wallet');
            const keychainRepository = database.getRepository('keychain');
            pipeline                 = pipeline.then(() => walletRepository.getWallet())
                                               .then(wallet => keychainRepository.getWalletDefaultKeyIdentifier(wallet.wallet_id))
                                               .then(addressKeyIdentifier => this.protocolAddressKeyIdentifier = addressKeyIdentifier);
        }

        pipeline.then(() => {
            const languageRepository   = database.getRepository('language');
            const advertiserRepository = database.getRepository('advertiser');

            /*todo: get an actual data from DB
            const advertisementTypes = [
                'text_headline',
                'text_headline_deck',
                'banner_300x50',
                'banner_728x90'
            ];*/

            const advertisementGUID         = Database.generateID(32);
            const headLineAttributeGUID     = Database.generateID(32);
            const deckAttributeGUID         = Database.generateID(32);
            const targetPhraseAttributeGUID = Database.generateID(32);
            const targetLanguageUID         = Database.generateID(32);
            const advertisementType         = 'text_headline_deck';
            const expiration                = Math.floor(Math.random() * 10) * 86400;
            const fundingAddress            = `${this.protocolAddressKeyIdentifier}0a0${this.protocolAddressKeyIdentifier}`;

            //todo: replace with actual data
            const budgetUSD        = Math.floor(Math.max(100, Math.random() * 1000));
            const bidImpressionUSD = Math.max(0.1, Math.random()).toFixed(2);

            return languageRepository
                .getLanguageByGuid(payload.target_language)
                .then((languageData) => {
                    return advertiserRepository.getCategoryByGuid(payload.category).then(categoryData => {
                        const advertisementAttributes = [
                            {
                                attribute_guid: headLineAttributeGUID,
                                attribute_type: 'advertisement_headline',
                                object        : undefined,
                                object_key    : undefined,
                                value         : payload.headline
                            },
                            {
                                attribute_guid: deckAttributeGUID,
                                attribute_type: 'advertisement_deck',
                                object        : undefined,
                                object_key    : undefined,
                                value         : payload.deck
                            },
                            {
                                attribute_guid: targetPhraseAttributeGUID,
                                attribute_type: 'target_phrase',
                                object        : 'target phrase',
                                object_key    : undefined,
                                value         : payload.target_phrase
                            },
                            {
                                attribute_guid: targetLanguageUID,
                                attribute_type: 'target_language',
                                object        : 'language',
                                object_key    : undefined,
                                value         : languageData.language_code
                            }
                        ];

                        return advertiserRepository.createAdvertisement(
                            advertisementGUID,
                            advertisementType,
                            categoryData.advertisement_category,
                            payload.creative_name,
                            payload.url,
                            fundingAddress,
                            budgetUSD,
                            payload.daily_budget_mlx,
                            bidImpressionUSD,
                            bidPerImpressionMLX,
                            expiration,
                            advertisementAttributes
                        ).then(advertisement => res.send({
                            api_status   : 'ok',
                            api_message  : 'created successfully',
                            advertisement: advertisement
                        }));
                    });

                }).catch(e => res.send({
                    api_status : 'fail',
                    api_message: `unexpected generic api error: (${e})`
                }));
        });
    }
}


export default new _scWZ0yhuk5hHLd8s();
