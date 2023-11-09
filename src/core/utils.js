import Mnemonic from 'bitcore-mnemonic';
import Bitcore from 'bitcore-lib';
import crypto from 'crypto';
import config from '../config/config';
import fs from 'fs';
import path from 'path';
import base58 from 'bs58';
import objectHash from './crypto/object-hash';
import signature from './crypto/signature';
import os from 'os';
import {KJUR, KEYUTIL, X509} from 'jsrsasign';
import async from 'async';
import _ from 'lodash';
import {v4 as uuidv4} from 'uuid';


class Utils {
    getAddressFromPublicKey(addressKeyPublicBuffer) {
        const hash            = crypto.createHash('sha256').update(addressKeyPublicBuffer).digest();
        const encryptedPubKey = '00' + crypto.createHash('ripemd160').update(hash).digest('hex');
        let checksum          = crypto.createHash('sha256').update(encryptedPubKey, 'hex').digest();
        checksum              = crypto.createHash('sha256').update(checksum).digest('hex').substring(0, 8);
        let hexAddress        = encryptedPubKey + checksum;
        return base58.encode(Buffer.from(hexAddress, 'hex'));
    }

    newMnemonic() {
        let mnemonic = new Mnemonic(256); // generates new mnemonic
        while (!Mnemonic.isValid(mnemonic.toString())) {
            mnemonic = new Mnemonic(256);
        }
        return mnemonic;
    }


    generateNodeKey() {
        const mnemonic = this.newMnemonic();
        return mnemonic.toHDPrivateKey(uuidv4());
    }

    getNodeIdFromPublicKey(publicKey) {
        return this.getAddressFromPublicKey(base58.decode(publicKey));
    }

    _getCertificateExtension(oid, valueHex) {
        const extension           = new KJUR.asn1.x509.Extension();
        extension.oid             = oid;
        extension.getExtnValueHex = () => valueHex;
        return extension;
    }

    signMessage(nodePrivateKey, message) {
        return signature.sign(objectHash.getHashBuffer(message), nodePrivateKey.toBuffer());
    }

    loadNodeKeyAndCertificate() {
        return new Promise((resolve, reject) => {
            const elements = [
                {
                    file       : config.NODE_CERTIFICATE_KEY_PATH,
                    transformer: KEYUTIL.getKey,
                    key        : 'certificate_private_key'
                },
                {
                    file       : config.NODE_KEY_PATH,
                    transformer: (data) => new Bitcore.HDPrivateKey(data),
                    key        : 'node'
                },
                {
                    file       : config.NODE_CERTIFICATE_PATH,
                    transformer: (pem) => {
                        const x509 = new X509();
                        x509.readCertPEM(pem);
                        return x509;
                    },
                    key        : 'certificate'
                }
            ];
            async.mapSeries(elements, (element, callback) => {
                fs.readFile(element.file, 'utf8', (err, pemData) => {
                    if (err) {
                        return callback(true);
                    }
                    try {
                        if (element.key === 'node') {
                            const data = JSON.parse(pemData);
                            if (data.key) {
                                const obj = element.transformer(data.key);
                                return callback(null, {
                                    [element.key + '_private_key']: obj.privateKey,
                                    [element.key + '_public_key'] : obj.publicKey,
                                    [element.key + '_id']         : data.node_id,
                                    [element.key + '_signature']  : data.node_signature || this.signMessage(obj.privateKey, data.node_id)
                                });
                            }
                            else {
                                return callback(true);
                            }
                        }
                        else {
                            const obj = element.transformer(pemData);
                            return callback(null, {
                                [element.key]         : obj,
                                [element.key + '_pem']: pemData
                            });
                        }
                    }
                    catch (e) {
                        return callback(true);
                    }
                });
            }, (error, data) => {
                if (!error) {
                    return resolve(_.reduce(data, (obj, item) => ({...obj, ...item})));
                }
                else {
                    const ecKeypair = KEYUTIL.generateKeypair('EC', 'secp256r1');

                    // generate TBSCertificate
                    const tbsc = new KJUR.asn1.x509.TBSCertificate();

                    // add basic fields
                    tbsc.setSerialNumberByParam({'int': Date.now()});
                    tbsc.setSignatureAlgByParam({'name': 'SHA1withECDSA'});
                    tbsc.setIssuerByParam({'str': '/C=US/O=millix foundation/CN=mlx/ST=millix network'});
                    tbsc.setNotBeforeByParam({'str': '200504235959Z'});
                    tbsc.setNotAfterByParam({'str': '300504235959Z'});
                    tbsc.setSubjectByParam({'str': '/C=US/O=millix foundation/CN=mlx/ST=millix network'});
                    tbsc.setSubjectPublicKeyByGetKey(ecKeypair.pubKeyObj);
                    // add extensions
                    tbsc.appendExtension(new KJUR.asn1.x509.BasicConstraints({'cA': true}));
                    const subjectKeyIdentifierHex = KJUR.crypto.Util.hashHex(ecKeypair.pubKeyObj.pubKeyHex, 'sha1');
                    tbsc.appendExtension(new KJUR.asn1.x509.SubjectKeyIdentifier({kid: {hex: subjectKeyIdentifierHex}}));
                    tbsc.appendExtension(new KJUR.asn1.x509.AuthorityKeyIdentifier({kid: {hex: subjectKeyIdentifierHex}}));
                    this.loadOrCreateNodeKey().then(nodeKey => {
                        const nodePublicKeyHex = nodeKey.publicKey.toString();
                        const nodeID           = this.getAddressFromPublicKey(nodeKey.publicKey.toBuffer());
                        tbsc.appendExtension(this._getCertificateExtension('1.3.6.1.5.5.7.1.24.1', KJUR.asn1.ASN1Util.newObject({'bitstr': '04' + nodePublicKeyHex}).getEncodedHex()));
                        tbsc.appendExtension(this._getCertificateExtension('1.3.6.1.5.5.7.1.24.2', KJUR.asn1.ASN1Util.newObject({'utf8str': nodeID}).getEncodedHex()));
                        const tbscNodeSignatureHex = signature.sign(objectHash.getHashBuffer(Buffer.from(tbsc.getEncodedHex(), 'hex'), true), nodeKey.privateKey.toBuffer(), 'hex');
                        tbsc.appendExtension(this._getCertificateExtension('1.3.6.1.5.5.7.1.24.3', KJUR.asn1.ASN1Util.newObject({'bitstr': '04' + tbscNodeSignatureHex}).getEncodedHex()));

                        // sign and get PEM certificate with CA private key
                        const certificate = new KJUR.asn1.x509.Certificate({
                            'tbscertobj': tbsc,
                            'prvkeyobj' : ecKeypair.prvKeyObj
                        });
                        certificate.sign();
                        const certificatePem = certificate.getPEMString();

                        const privateKeyPem = KEYUTIL.getPEM(ecKeypair.prvKeyObj, 'PKCS1PRV');

                        fs.writeFile(config.NODE_CERTIFICATE_KEY_PATH, privateKeyPem, 'utf8', (err) => {
                            if (err) {
                                return reject('failed to write node private key file');
                            }
                            fs.writeFile(config.NODE_CERTIFICATE_PATH, certificatePem, 'utf8', (err) => {
                                if (err) {
                                    return reject('failed to write node certificate file');
                                }
                                resolve({
                                    certificate_private_key    : ecKeypair.prvKeyObj,
                                    certificate_private_key_pem: privateKeyPem,
                                    certificate                : certificate,
                                    certificate_pem            : certificatePem,
                                    node_private_key           : nodeKey.privateKey,
                                    node_public_key            : nodeKey.publicKey,
                                    node_id                    : nodeID,
                                    node_signature             : this.signMessage(nodeKey.privateKey, nodeID)
                                });
                            });
                        });
                    }).catch(() => reject('failed to create node id file'));
                }
            });
        });
    }

    loadOrCreateNodeKey() {
        return new Promise((resolve, reject) => {
            this.loadNodeKey()
                .then(nodeKey => resolve(nodeKey))
                .catch(() => {
                    const nodeKey = this.generateNodeKey();
                    this.storeNodeKey(nodeKey)
                        .then(() => resolve(nodeKey))
                        .catch(() => reject());
                });
        });
    }

    loadNodeKey() {
        return new Promise((resolve, reject) => {
            fs.readFile(config.NODE_KEY_PATH, 'utf8', function(err, data) {
                if (err) {
                    return reject('couldn\'t read node key');
                }

                data = JSON.parse(data);
                if (data.key) {
                    return resolve(new Bitcore.HDPrivateKey(data.key));
                }
                else {
                    return reject('couldn\'t read node key');
                }
            });
        });
    }

    storeNodeKey(key) {
        return new Promise((resolve, reject) => {
            fs.writeFile(config.NODE_KEY_PATH, JSON.stringify({key: key.toString()}, null, '\t'), 'utf8', function(err) {
                if (err) {
                    return reject('failed to write node key file');
                }
                resolve(key);
            });
        });
    }

    getAddressComponent(addressFull) {
        addressFull   = addressFull.trim();
        const matches = addressFull.match(new RegExp("(?<address>.*)(?<version>0a0)(?<identifier>.*)"));
        if (!matches || !matches.groups['address'] || !matches.groups['version'] || !matches.groups['identifier']) {
            return {};
        }
        const address    = matches.groups['address'];
        const version    = matches.groups['version'];
        const identifier = matches.groups['identifier'];
        return {
            address,
            version,
            identifier
        };
    }
}


export default new Utils();
