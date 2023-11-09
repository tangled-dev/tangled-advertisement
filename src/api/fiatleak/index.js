import request from 'request';


class FiatLeakAPI {
    static FIATLEAK_API = 'https://fiatleak.com/api';

    getCurrencyPairSummary(ticker = 'usd') {
        return new Promise((resolve, reject) => {
            request.get(FiatLeakAPI.FIATLEAK_API + '/currency/pair/price/mlx/' + ticker, {}, function(error, response, body) {
                try {
                    if (!error && response.statusCode === 200) {
                        resolve(typeof body === 'string' ? JSON.parse(body) : body);
                    }
                    else {
                        reject(error && error.message || JSON.parse(body));
                    }
                }catch (e) {
                    reject(e);
                }
            });
        });
    }
}


const _FiatLeakAPI = new FiatLeakAPI();
export default _FiatLeakAPI;
