import api from '../api/server';
import database from '../database/database';
import network from '../network/network';
import peer from '../network/peer';
import configLoader from '../config/config-loader';
import ntp from './ntp';
import FiatleakAPI from '../api/fiatleak';
import task from './task';
import cache from './cache';


class Service {
    constructor() {
        this.initialized = false;
    }

    updateMLXUSDPrice() {
        return FiatleakAPI.getCurrencyPairSummary().then(summary => {
            const mlxUSDPrice = summary?.data?.price || 0;
            cache.setCacheItem('service', 'mlx_usd_price', mlxUSDPrice, Number.MAX_VALUE);
        }).catch(_ => _);
    }

    initialize(options = {}) {
        if (this.initialized) {
            return Promise.resolve();
        }
        this.initialized = true;
        return database.initialize()
                       .then(() => configLoader.load())
                       .then(() => database.checkup())
                       .then(() => {
                           task.scheduleTask('mlx_price_update', () => this.updateMLXUSDPrice(), 60000);
                           return this.updateMLXUSDPrice();
                       })
                       .then(() => ntp.initialize())
                       .then(() => peer.initialize())
                       .then(() => network.initialize(peer.protocolAddressKeyIdentifier))
                       .then(() => api.initialize())
                       .catch(e => {
                           console.log(`[service] ${e && (e.message || e.api_message) || e}`);
                           peer.stop();
                           network.stop();
                           api.stop();
                           this.initialized = false;
                           return new Promise(resolve => setTimeout(() => this.initialize(options).then(resolve), 5000));
                       });
    }

    stop() {
        if (!this.initialized) {
            return;
        }
        task.removeTask('mlx_price_update');
        this.initialized = false;
    }
}


export default new Service();
