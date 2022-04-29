import Endpoint from '../endpoint';
import database from '../../database/database';


/**
 * api get_advertisment_by_id
 */

class _ae60ccb743cd3c79 extends Endpoint {
    constructor() {
        super('ae60ccb743cd3c79');
    }

    /**
     * returns advertisment by id
     * @param app
     * @param req (p0: advertisement_guid<required>)
     * @param res
     */

    handler(app, req, res) {

        const {
                  p0: advertisementGUID
              } = req.query;

        const advertiserRepository = database.getRepository('advertiser');
        advertiserRepository.getAdvertisementById({advertisement_guid: advertisementGUID})
                            .then(advertisement => {
                                if (advertisement) {
                                    let attributesRepository = database.getRepository('advertiser_attributes');
                                    attributesRepository.get({advertisement_guid: advertisementGUID}).then(attributes => {
                                        for (const attribute of attributes) {
                                            advertisement[attribute.attribute_type] = {
                                                value: attribute.value,
                                                guid : attribute.advertisement_attribute_guid
                                            };
                                        }

                                        res.send({
                                            api_status   : 'success',
                                            advertisement: advertisement
                                        });
                                    }).catch(e => res.send({
                                        api_status : 'fail',
                                        api_message: `unexpected generic api error: (${e})`
                                    }));
                                }
                                else {
                                    res.send({
                                        api_status : 'success',
                                        api_message: `advertisement not found`
                                    });
                                }
                            })
                            .catch(e => res.send({
                                api_status : 'fail',
                                api_message: `unexpected generic api error: (${e})`
                            }));
    }
}


export default new _ae60ccb743cd3c79();

