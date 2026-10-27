import _ from 'lodash';
import task from './task';


class Cache {
    constructor() {
        this.initialized = false;
        this.jobRunning  = false;
        this.cache       = {};
    }

    _purgeCache() {
        const now = Date.now();
        _.each(_.keys(this.cache), store => {
            _.each(_.keys(this.cache[store]), key => {
                if (now > this.cache[store][key].purge_time) {
                    delete this.cache[store][key];
                }
            });
        });
    }

    // returns the entry only while it is live, so expiry holds even if the purge job is not running
    _getCacheEntry(store, key) {
        const entry = this.cache[store] && this.cache[store][key];
        if (!entry) {
            return null;
        }
        if (Date.now() > entry.purge_time) {
            delete this.cache[store][key];
            return null;
        }
        return entry;
    }

    removeCacheItem(store, key) {
        if (this.cache[store] && this.cache[store][key]) {
            delete this.cache[store][key];
        }
    }

    refreshCacheTime(store, key, cacheTime = 30000) {
        const entry = this._getCacheEntry(store, key);
        if (entry) {
            entry.purge_time = Date.now() + cacheTime;
        }
    }

    setCacheItem(store, key, value, cacheTime = 30000) {
        if (!this.cache[store]) {
            this.cache[store] = {};
        }

        this.cache[store][key] = {
            value,
            purge_time: Date.now() + cacheTime
        };
    }

    getCachedIfPresent(store, key, getter, cacheTime = 30000) {
        const cachedItem = this.getCacheItem(store, key);
        return cachedItem ? Promise.resolve(cachedItem) : getter().then(value => {
            this.setCacheItem(store, key, value, cacheTime);
            return value;
        });
    }

    getCacheItem(store, key) {
        const entry = this._getCacheEntry(store, key);
        return entry ? entry.value : null;
    }

    initialize() {
        if (this.initialized) {
            if (!this.jobRunning) {
                task.scheduleTask('cache_purge', this._purgeCache.bind(this), 30000);
                this.jobRunning = true;
            }
            return Promise.resolve();
        }

        this.initialized = true;
        task.scheduleTask('cache_purge', this._purgeCache.bind(this), 30000);
        this.jobRunning = true;
        return Promise.resolve();
    }

    stop() {
        task.removeTask('cache_purge');
        this.jobRunning = false;
    }
}


export default new Cache();
