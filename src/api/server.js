import https from 'https';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import async from 'async';
import apiConfig from '../config/api.json';
import config from '../config/config';
import _ from 'lodash';
import database from '../database/database';
import utils from '../core/utils';


class Server {
    constructor() {
        this.started = false;
    }

    _loadAPI() {
        return new Promise(resolve => {
            const apiRepository = database.getRepository('api');
            async.eachSeries(apiConfig.endpoint_list, (api, callback) => {
                apiRepository.addAPI(api)
                             .then(() => callback());
            }, () => {
                apiRepository.list()
                             .then(apis => resolve(apis));
            });
        });
    }

    initialize() {
        return new Promise(resolve => {
            if (this.started) {
                return resolve();
            }

            this.started = true;

            this._loadAPI().then(apis => {
                _.each(apis, api => api.permission = JSON.parse(api.permission));
                // defining the Express app
                const app = express();

                const appInfo = {
                    name   : config.NAME,
                    version: config.VERSION
                };

                // adding Helmet to enhance your API's
                // security
                app.use(helmet());

                // using bodyParser to parse JSON bodies
                // into JS objects
                app.use(bodyParser.json({limit: '50mb'}));

                // enabling CORS for all requests
                app.use(cors());

                // defining an endpoint to return all ads
                app.get('/', (req, res) => {
                    res.send(appInfo);
                });

                // apis
                apis.forEach(api => {
                    let module;
                    try {
                        module = require('./' + api.api_id + '/index');
                    }
                    catch (e) {
                    }

                    if (module) {
                        module.default.register(app, api.permission);
                    }
                    else {
                        console.log('api source code not found');
                        database.getRepository('api').removeAPI(api.api_id);
                    }
                });

                app.use(function(err, req, res, next) {
                    if (err.name === 'UnauthorizedError') {
                        res.status(err.status).send({error: err.message});
                        return;
                    }
                    next();
                });
                utils.loadNodeKeyAndCertificate()
                           .then(({
                                      certificate_private_key_pem: certificatePrivateKeyPem,
                                      certificate_pem            : certificatePem
                                  }) => {
                               // starting the server
                               const httpsServer = https.createServer({
                                   key      : certificatePrivateKeyPem,
                                   cert     : certificatePem,
                                   ecdhCurve: 'prime256v1'
                               }, app);

                               httpsServer.listen(config.NODE_PORT_API, config.NODE_BIND_IP, () => {
                                   console.log(`[api] listening on port ${config.NODE_PORT_API}`);
                                   resolve();
                               });
                           });
            });
        });
    }
}


export default new Server();
