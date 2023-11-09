import request from 'request';


export class Client {
    static HOST = 'localhost';
    static PORT = 5500;

    constructor() {
        this.nodeID        = undefined;
        this.nodeSignature = undefined;

        try {
            const environment = require('../environment');

            this.nodeID        = environment.NODE_ID;
            this.nodeSignature = environment.NODE_SIGNATURE;
        }
        catch (ex) {
        }
    }

    loadCredentials(nodeID, nodeSignature) {
        this.nodeID        = nodeID;
        this.nodeSignature = nodeSignature;
    }

    static sendPost(url, json) {
        return new Promise((resolve, reject) => {
            request.post(
                url,
                {
                    json,
                    rejectUnauthorized: false
                },
                function(error, response, body) {
                    if (!error && response.statusCode === 200) {
                        resolve(typeof body === 'string' ? JSON.parse(body) : body);
                    }
                    else {
                        reject(body);
                    }
                }
            );
        });
    }

    static sendGet(url) {
        return new Promise((resolve, reject) => {
            request.get(
                url,
                {
                    rejectUnauthorized: false
                },
                function(error, response, body) {
                    if (!error && response.statusCode === 200) {
                        resolve(typeof body === 'string' ? JSON.parse(body) : body);
                    }
                    else {
                        reject(error && error.message || JSON.parse(body));
                    }
                }
            );
        });
    }

    post(path, json) {
        return Client.sendPost(`https://${Client.HOST}:${Client.PORT}/${path}`, json);
    }

    get(path) {
        return Client.sendGet(`https://${Client.HOST}:${Client.PORT}/${path}`);
    }

    getWalletInformation() {
        return this.get(`api/${this.nodeID}/${this.nodeSignature}/OBexeX0f0MsnL1S3`);
    }

    sendTransaction(payload) {
        return this.post(`api/${this.nodeID}/${this.nodeSignature}/XPzc85T3reYmGro1`, {p0: payload});
    }

    getTransactionOutput(transactionId, outputPosition) {
        return this.post(`api/${this.nodeID}/${this.nodeSignature}/KN2ZttYDEKzCulEZ`, {
            p0: transactionId,
            p1: outputPosition,
            p2: 'qGuUgMMVmaCvqrvoWG6zARjkrujGMpzJmpNhBgz1y3RjBG7ZR'
        });
    }

    listTransactionOutput(transactionId, outputPosition) {
        return this.get(`api/${this.nodeID}/${this.nodeSignature}/KN2ZttYDEKzCulEZ?p0=${transactionId}&p1=${outputPosition}&p2=qGuUgMMVmaCvqrvoWG6zARjkrujGMpzJmpNhBgz1y3RjBG7ZR`);
    }
}


const client = new Client();
export default client;
