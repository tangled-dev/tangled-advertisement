import request from 'request';


class Client {
    static HOST = 'localhost';
    static PORT = 5500;

    constructor() {
        this.nodeID        = undefined;
        this.nodeSignature = undefined;
    }

    loadCredentials(nodeID, nodeSignature) {
        this.nodeID        = nodeID;
        this.nodeSignature = nodeSignature;
    }

    post(path, json) {
        return new Promise((resolve, reject) => {
            request.post(
                `https://${Client.HOST}:${Client.PORT}/${path}`,
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

    get(path) {
        return new Promise((resolve, reject) => {
            request.post(
                `https://${Client.HOST}:${Client.PORT}/${path}`,
                {
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

    getWalletInformation() {
        return this.get(`api/${this.nodeID}/${this.nodeSignature}/OBexeX0f0MsnL1S3`);
    }

    sendTransaction(payload) {
        return this.post(`api/${this.nodeID}/${this.nodeSignature}/XPzc85T3reYmGro1`, {p0: payload});
    }
}


const client = new Client();
export default client;
