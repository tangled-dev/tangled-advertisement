import https from 'https';


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
            const data = JSON.stringify(json);

            const req = https.request({
                hostname          : Client.HOST,
                port              : Client.PORT,
                path              : path,
                method            : 'POST',
                headers           : {
                    'Content-Type'  : 'application/json',
                    'Content-Length': data.length
                },
                rejectUnauthorized: false
            }, res => {
                let response = '';
                res.on('data', data => {
                    response += data;
                });

                res.on('end', () => {
                    try {
                        resolve(JSON.parse(response));
                    }
                    catch (error) {
                        reject(error.message);
                    }
                    req.end();
                });
            });

            req.on('error', error => {
                reject(error);
                req.end();
            });

            req.write(data);
        });
    }

    sendTransaction(payload) {
        return this.post(`/api/${this.nodeID}/${this.nodeSignature}/XPzc85T3reYmGro1`, {p0: payload});
    }
}


const client = new Client();
export default client;
