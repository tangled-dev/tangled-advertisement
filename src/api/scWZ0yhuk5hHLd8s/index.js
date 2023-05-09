import Endpoint from '../endpoint';
import database, {Database} from '../../database/database';
import config from '../../config/config';
import peer from '../../network/peer';


/**
 * api advertisement_upsert
 */
class _scWZ0yhuk5hHLd8s extends Endpoint {
    constructor() {
        super('scWZ0yhuk5hHLd8s');
    }

    /**
     * create or update ad and return it content
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
            !payload.advertisement_name ||
            !payload.advertisement_category_guid ||
            !payload.headline ||
            !payload.deck ||
            !payload.url ||
            !payload.budget_daily_mlx ||
            !payload.bid_impression_mlx
        ) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `advertisement_name<advertisement_name>, category<advertisement_category_guid>, headline<headline>, deck<deck>, url<url>, budget_daily_mlx<budget_daily_mlx>, bid_impression_mlx<bid_impression_mlx>`
            });
        }


        if (payload.advertisement_guid && (
            !payload.head_line_attribute_guid ||
            !payload.deck_attribute_guid)
        ) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `head_line_attribute_guid<head_line_attribute_guid>, deck_attribute_guid<deck_attribute_guid>`
            });
        }

        const bidImpressionMlx = Math.floor(payload.bid_impression_mlx);
        if (bidImpressionMlx > config.ADS_TRANSACTION_AMOUNT_MAX) {
            return res.status(400).send({
                api_status : 'fail',
                api_message: `bid_impression_mlx (${payload.bid_impression_mlx}) is greater than the maximum allowed value: max bid per impression is ${config.ADS_TRANSACTION_AMOUNT_MAX}, current value is ${bidImpressionMlx}`
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
            const advertiserRepository = database.getRepository('advertiser');

            /*todo: get an actual data from DB
             const advertisement_type_list = [
             'text_headline',
             'text_headline_deck',
             'banner_300x50',
             'banner_728x90'
             ];*/

            let advertisementGuid       = Database.generateID(32);
            let deckAttributeGuid      = Database.generateID(32);
            let headlineAttributeGuid = Database.generateID(32);
            if (payload.advertisement_guid) {
                advertisementGuid       = payload.advertisement_guid;
                deckAttributeGuid      = payload.deck_attribute_guid;
                headlineAttributeGuid = payload.head_line_attribute_guid;
            }


            const advertisementType = 'text_headline_deck';
            const expiration         = payload.expiration || 31536000 // 365 days;
            const fundingAddress     = `${peer.protocolAddressKeyIdentifier}0a0${peer.protocolAddressKeyIdentifier}`;

            //todo: replace with actual data
            const budgetUSD        = Math.floor(Math.max(100, Math.random() * 1000));
            const bidImpressionUSD = Math.max(0.1, Math.random()).toFixed(2);

            return advertiserRepository.getCategoryByGuid(payload.advertisement_category_guid).then(categoryData => {
                const advertisementAttributes = [
                    {
                        attribute_guid: headlineAttributeGuid,
                        attribute_type: 'advertisement_headline',
                        object        : undefined,
                        object_key    : undefined,
                        value         : payload.headline
                    },
                    {
                        attribute_guid: deckAttributeGuid,
                        attribute_type: 'advertisement_deck',
                        object        : undefined,
                        object_key    : undefined,
                        value         : payload.deck
                    }
                ];

                if (payload.advertisement_guid) {
                    return advertiserRepository.updateAdvertisement(
                        advertisementGuid,
                        advertisementType,
                        categoryData.advertisement_category,
                        payload.advertisement_name,
                        payload.url,
                        fundingAddress,
                        budgetUSD,
                        payload.budget_daily_mlx,
                        bidImpressionUSD,
                        bidImpressionMlx,
                        expiration,
                        advertisementAttributes
                    ).then(advertisement => res.send({
                        api_status   : 'success',
                        advertisement: advertisement
                    }));
                }
                else {
                    return advertiserRepository.createAdvertisement(
                        advertisementGuid,
                        advertisementType,
                        categoryData.advertisement_category,
                        payload.advertisement_name,
                        payload.url,
                        fundingAddress,
                        budgetUSD,
                        payload.budget_daily_mlx,
                        bidImpressionUSD,
                        bidImpressionMlx,
                        expiration,
                        advertisementAttributes
                    ).then(advertisement => res.send({
                        api_status   : 'success',
                        advertisement: advertisement
                    }));
                }
            }).catch(e => res.send({
                api_status : 'fail',
                api_message: `unexpected generic api error: (${e})`
            }));
        });
    }
}


export default new _scWZ0yhuk5hHLd8s();
