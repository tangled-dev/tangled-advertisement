export default class Endpoint {
    constructor(endpoint) {
        this.endpoint = endpoint;
        this.baseURL  = '/api/';
    }

    handler() {
        throw new Error('You must to implement the method handler!');
    }

    onRequest(app, permission, req, res) {
            this.handler(app, req, res);
    }

    register(app, permission) {
        app.post(this.baseURL + this.endpoint, this.onRequest.bind(this, app, permission));
        app.get(this.baseURL + this.endpoint, this.onRequest.bind(this, app, permission));
    }
}
