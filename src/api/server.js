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
        this.started     = false;
        this.httpsServer = null;
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
        if (this.started) {
            return Promise.resolve();
        }

        this.started = true;

        return this._loadAPI().then(apis => {
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
            return utils.loadNodeKeyAndCertificate()
                        .then(({
                                   certificate_private_key_pem: certificatePrivateKeyPem,
                                   certificate_pem            : certificatePem
                               }) => {
                            // starting the server
                            this.httpsServer = https.createServer({
                                key      : certificatePrivateKeyPem,
                                cert     : certificatePem,
                                ecdhCurve: 'prime256v1'
                            }, app);

                            return new Promise((resolve, reject) => {
                                this.httpsServer.listen(config.NODE_PORT_API, config.NODE_BIND_IP, () => {
                                    console.log(`[api] listening on port ${config.NODE_PORT_API}`);
                                    resolve();
                                }).on('error', err => {
                                    console.log(`[api] error binding on port ${config.NODE_PORT_API}`);
                                    reject(err);
                                });
                            });
                        });
        });
    }

    stop() {
        if (this.httpsServer) {
            this.httpsServer.close();
            this.httpsServer = null;
            this.started     = false;
        }
    }
}


export default new Server();
