import crypto from 'crypto';
import cHash from './chash';
import objectUtils from '../object-utils';

function getCHash160(obj) {
    return cHash.getCHash160(objectUtils.asString(obj));
}

function getCHash288(obj) {
    return cHash.getCHash288(objectUtils.asString(obj));
}

function getHashBuffer(obj, fromBuffer) {
    if (!fromBuffer) {
        return crypto.createHash('sha256').update(objectUtils.asString(obj), 'utf8').digest();
    }
    else {
        return crypto.createHash('sha256').update(obj, 'utf8').digest();
    }
}

function getSHA1Buffer(obj, fromBuffer) {
    if (!fromBuffer) {
        return crypto.createHash('sha1').update(objectUtils.asString(obj), 'utf8').digest();
    }
    else {
        return crypto.createHash('sha1').update(obj, 'utf8').digest();
    }
}

function getMD5Buffer(message) {
    return crypto.createHash('md5').update(message, 'utf8').digest();
}

export default {
    getMD5Buffer,
    getCHash160,
    getCHash288,
    getHashBuffer,
    getSHA1Buffer
};


