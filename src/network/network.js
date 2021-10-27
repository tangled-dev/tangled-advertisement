import WebSocket, {WebSocketServer} from 'ws';
import _ from 'lodash';
import config from '../config/config';
import database from '../database/database';
import eventBus from '../core/event-bus';
import crypto from 'crypto';
import async from 'async';
import base58 from 'bs58';
import publicIp from 'public-ip';
import util from 'util';
import dns from 'dns';
import NatAPI from 'nat-api';
import task from '../core/task';
import Utils from '../core/utils';
import client from '../api/client';


class Network {
    constructor() {
        this._nodeList           = {};
        this._connectionRegistry = {};
        this._nodeRegistry       = {};
        this._wss                = null;
        this.nodeID              = null;
        this.nodeConnectionID    = null;
        this._selfConnectionNode = new Set();
        this.initialized         = false;
    }

    get registeredClients() {
        return _.map(_.filter(_.values(this._nodeRegistry), listWS => listWS.length > 0), listWS => listWS[0]);
    }

    get nodeList() {
        return this._nodeList;
    }

    getNodeSocket(nodeID) {
        return _.first(this._nodeRegistry[nodeID]);
    }

    generateNewID() {
        return crypto.randomBytes(20).toString('hex');
    }

    setWebSocket(wss) {
        this._wss = wss;
    }

    getWebSocket() {
        return this._wss;
    }

    addNode(prefix, ip, port, id) {
        let url = prefix + ip + ':' + port;
        if (!this._nodeList[url]) {
            const now           = Math.floor(Date.now() / 1000);
            this._nodeList[url] = {
                node_prefix : prefix,
                node_address: ip,
                node_port   : port,
                node_id     : id,
                create_date : now,
                update_date : now,
                status      : -1
            };
            return true;
        }
        return false;
    }

    // general network functions
    _connectTo(prefix, ipAddress, port, id) {

        if (this._nodeRegistry[id] && this._nodeRegistry[id][0]) {
            return Promise.resolve(this._nodeRegistry[id][0]);
        }
        else if (!prefix || !ipAddress || !port || id === this.nodeID) {
            return Promise.reject();
        }

        return new Promise((resolve, reject) => {

            let url = prefix + ipAddress + ':' + port;

            if (!url || this._selfConnectionNode.has(url) || (id && this._nodeRegistry[id])) {
                return reject(this._selfConnectionNode.has(url) ? 'self-connection' : `node ${id} is already connected`);
            }

            const ws = new WebSocket(url, {
                rejectUnauthorized: false,
                handshakeTimeout  : 10000
            });

            ws.setMaxListeners(20); // avoid warning
            ws.createTime = Date.now();

            ws.once('open', () => {
                console.log('[network outgoing] Open connection to ' + url);

                ws.node            = url;
                ws.nodePort        = port;
                ws.nodePrefix      = prefix;
                ws.nodeIPAddress   = ipAddress;
                ws.lastMessageTime = ws.createTime;
                ws.outBound        = true;
                console.log('[network outgoing] connected to ' + url + ', host ' + ws.nodeIPAddress);

                this._doHandshake(ws);
                resolve();
            });

            ws.on('close', () => {
                console.log('[network outgoing] close event, removing ' + url);

                // !ws.bOutbound means not connected yet. This is to
                // distinguish connection errors from later errors that occur
                // on open connection
                if (!ws.outBound) {
                    return reject('client closed the connection');
                }

                this._unregisterWebsocket(ws);
            });

            ws.on('error', (e) => {
                console.log('[network outgoing] error in connection to nodes ' + e + '. disconnected after ' + (Date.now() - ws.createTime) + 'ms.');
                // !ws.bOutbound means not connected yet. This is to
                // distinguish connection errors from later errors that occur
                // on open connection
                if (!ws.outBound) {
                    return reject('there was an error in the connection,' + e);
                }

                this._unregisterWebsocket(ws);
            });

            ws.on('message', this._onWebsocketMessage.bind(this, ws));
            console.log('[network outgoing] connecting to node', url);

        });
    }

    _onWebsocketMessage(ws, message) {

        if (ws.readyState !== ws.OPEN) {
            return;
        }

        ws.lastMessageTime = Date.now();

        let jsonMessage;

        try {
            jsonMessage = JSON.parse(message);
        }
        catch (e) {
            return console.log('[network] failed to parse json message ' + message);
        }

        const messageType = jsonMessage.type;
        const content     = jsonMessage.content;

        eventBus.emit(messageType, content, ws);
    }

    startAcceptingConnections(port = config.NODE_PORT, host = config.NODE_BIND_IP) {
        // starting the server
        let wss = new WebSocketServer({
            port,
            host
        });

        this.setWebSocket(wss);

        wss.on('connection', (ws, req) => {

            let ip;
            if (req.connection.remoteAddress) {
                ip = req.connection.remoteAddress.replace('::ffff:', '');
            }

            if (!ip) {
                console.log('[network income] no ip in accepted connection');
                ws.terminate();
                return;
            }

            if (req.headers['x-real-ip'] && (ip === '127.0.0.1' || ip.match(/^192\.168\./))) {
                // we are behind a proxy
                ip = req.headers['x-real-ip'];
            }

            ws.node            = config.WEBSOCKET_PROTOCOL + ip + ':' + req.connection.remotePort;
            ws.createTime      = Date.now();
            ws.lastMessageTime = ws.createTime;
            ws.inBound         = true;

            console.log('[network income] got connection from ' + ws.node + ', host ' + ip);


            ws.on('message', this._onWebsocketMessage.bind(this, ws));

            ws.on('close', () => {
                console.log('[network income] client ' + ws.node + ' disconnected');
                this._unregisterWebsocket(ws);
            });

            ws.on('error', (e) => {
                console.log('[network income] error on client ' + ip + ': ' + e);
                ws.close(1000, 'received error');
                this._unregisterWebsocket(ws);
            });

            this._doHandshake(ws);
        });

        wss.on('listening', () => console.log(`[network] wss running at port ${host}:${port}`));
        wss.on('error', (e) => console.log(`[network] wss error ${e}`));
        wss.on('close', (e) => console.log(`[network] wss close ${e}`));
    }

    connectToNodes() {
        database.getRepository('node')
                .listNodes()
                .then((nodes) => {
                    async.eachSeries(_.shuffle(nodes), (node, callback) => {
                        this.addNode(node.node_prefix, node.node_address, node.node_port, node.node_id);
                        callback();
                    }, () => {
                        _.each(_.shuffle(config.NODE_INITIAL_LIST), ({
                                                                         host,
                                                                         port
                                                                     }) => {
                            let prefix = config.WEBSOCKET_PROTOCOL;
                            let url    = `${prefix}://${host}:${port}`;
                            if ((!this._nodeList[url] || !this._nodeList[url].node_id) && (prefix && host && port)) {
                                this.addNode(prefix, host, port);
                            }
                        });
                        this.retryConnectToInactiveNodes().then(_ => _).catch(_ => _);
                    });
                });
    }


    retryConnectToInactiveNodes() {
        if (!this.initialized) {
            return Promise.resolve();
        }
        let inactiveClients = new Set();
        _.each(_.keys(this._nodeList), url => {
            let node = this._nodeList[url];
            if (!this._nodeRegistry[node.node_id] && !this._selfConnectionNode.has(url)) {
                inactiveClients.add(node);
            }
        });

        console.log(`[network] dead nodes size: ${inactiveClients.size} | active nodes: (${this.registeredClients.length})`);

        return new Promise(resolve => {
            async.eachLimit(_.shuffle(Array.from(inactiveClients)), 4, (node, callback) => {
                this._connectTo(node.node_prefix, node.node_address, node.node_port, node.node_id)
                    .then(() => setTimeout(callback, 1000))
                    .catch(() => setTimeout(callback, 1000));
            }, () => resolve());
        });
    }


    _doHandshake(ws) {
        let url     = config.WEBSOCKET_PROTOCOL + this.nodePublicIp + ':' + config.NODE_PORT;
        let payload = {
            type   : 'node_handshake',
            content: {
                node_id      : this.nodeID,
                connection_id: this.nodeConnectionID,
                node_prefix  : config.WEBSOCKET_PROTOCOL,
                node_address : this.nodePublicIp,
                node_port    : config.NODE_PORT,
                node         : url
            }
        };
        ws.send(JSON.stringify(payload));
    }

    _onNodeHandshake(registry, ws) {
        ws.nodeID       = ws.nodeID || registry.node_id;
        ws.connectionID = registry.connection_id;

        if (ws.nodeID === this.nodeID) {

            if (ws.outBound) {
                this._selfConnectionNode.add(ws.node);
            }

            console.log('[network] closing self-connection');
            ws.terminate();
            return;
        }

        if (this._registerWebsocketToNodeID(ws)) {
            this._registerWebsocketConnection(ws);
            if (ws.outBound) {
                const now               = Math.floor(Date.now() / 1000);
                this._nodeList[ws.node] = {
                    node_prefix : ws.nodePrefix,
                    node_address: ws.nodeIPAddress,
                    node_port   : parseInt(ws.nodePort),
                    node_id     : ws.nodeID,
                    create_date : now,
                    update_date : now,
                    status      : -1
                };
            }

            if (ws.inBound && registry.node_prefix && registry.node_address && registry.node_port && registry.node) {
                let node                      = _.pick(registry, [
                    'node_prefix',
                    'node_address',
                    'node_port',
                    'node_id',
                    'node'
                ]);
                const now                     = Math.floor(Date.now() / 1000);
                node['create_date']           = now;
                node['update_date']           = now;
                node['status']                = -1;
                ws.node                       = registry.node;
                ws.nodePrefix                 = node.node_prefix;
                ws.nodeIPAddress              = node.node_address;
                ws.nodePort                   = node.node_port;
                this._nodeList[registry.node] = node;
            }

            if (this.nodeList[ws.node]) {
                database.getRepository('node')
                        .addNode({
                            ...this.nodeList[ws.node],
                            status: 2
                        })
                        .then(() => eventBus.emit('node_list_update'))
                        .catch(() => eventBus.emit('node_list_update'));
            }

            eventBus.emit('peer_connection', ws);
        }
    }


    _registerWebsocketToNodeID(ws) {

        let nodeID = ws.nodeID;
        // global registry
        if (this._nodeRegistry[nodeID]) {
            this._nodeRegistry[nodeID].push(ws);
        }
        else {
            console.log('[network] node id ' + nodeID + ' registered');
            this._nodeRegistry[nodeID] = [ws];
        }

        console.log('[network] node ' + ws.node + ' registered with node id ' + nodeID);
        return true;
    }

    getWebSocketByID(connectionID) {
        if (this._connectionRegistry[connectionID]) {
            return this._connectionRegistry[connectionID][0];
        }
        return null;
    }

    _registerWebsocketConnection(ws) {
        let connectionID = ws.connectionID;
        if (this._connectionRegistry[connectionID]) {
            this._connectionRegistry[connectionID].push(ws);
            console.log('[network] node ' + ws.node + ' already registered with connection id ' + connectionID);
            return ws.close(1000, 'self-connection');
        }
        else {
            console.log('[network] node ' + ws.node + ' registered with connection id ' + connectionID);
            this._connectionRegistry[connectionID] = [ws];
        }
    }

    _unregisterWebsocket(ws) {
        if (ws.nodeID) {
            // remove from global registry
            _.pull(this._nodeRegistry[ws.nodeID], ws);
            if (this._nodeRegistry[ws.nodeID] && this._nodeRegistry[ws.nodeID].length === 0) {
                delete this._nodeRegistry[ws.nodeID];
                database.getRepository('node')
                        .updateNode({
                            ...this._nodeList[ws.node],
                            status: 1
                        }).then(_ => _);
            }

        }

        // remove from connection registry
        ws.connectionID && _.pull(this._connectionRegistry[ws.connectionID], ws);
        if (this._connectionRegistry[ws.connectionID] && this._connectionRegistry[ws.connectionID].length === 0) {
            delete this._connectionRegistry[ws.connectionID];
        }

        eventBus.emit('peer_connection_closed', ws);
        eventBus.emit('node_status_update');
    }


    doPortMapping() {
        if (!config.NODE_NAT_PMP) {
            return Promise.resolve();
        }

        const portMapper = util.promisify(this.natAPI.map.bind(this.natAPI));
        return portMapper({
            publicPort : config.NODE_PORT,
            privatePort: config.NODE_PORT,
            protocol   : 'TCP',
            description: 'tangled network'
        });
    }

    _initializeServer() {
        this.natAPI = new NatAPI();
        return Utils.loadNodeKeyAndCertificate()
                    .then(({
                               node_public_key: publicKey,
                               node_id        : nodeID,
                               node_signature : nodeSignature
                           }) => {
                        client.loadCredentials(nodeID, nodeSignature);
                        this.nodePublicKey = base58.encode(publicKey.toBuffer());
                        this.nodeID        = Utils.getNodeIdFromPublicKey(this.nodePublicKey);
                        console.log('node id : ', this.nodeID);
                        return this.doPortMapping()
                                   .then(() => this.startAcceptingConnections())
                                   .catch((e) => {
                                       console.log(`[network] error in nat-pmp ${e}`);
                                       return this.startAcceptingConnections();
                                   })
                                   .then(() => {
                                       this.connectToNodes();
                                       this.initialized = true;
                                       eventBus.on('node_handshake', this._onNodeHandshake.bind(this));
                                   });
                    });
    }

    initialize() {
        this.nodeConnectionID = this.generateNewID();

        console.log('[network] starting network');
        return (config.NODE_HOST_FORCE ?
                Promise.resolve(config.NODE_HOST) :
                publicIp.v4()
                        .then(ip => {
                            let dnsResolve4 = util.promisify(dns.resolve4);
                            return dnsResolve4(config.NODE_HOST)
                                .then(addresses => {
                                    if (addresses.includes(ip)) {
                                        return config.NODE_HOST;
                                    }
                                    else {
                                        return ip;
                                    }
                                })
                                .catch(() => ip);
                        })
        ).then(ip => {
            console.log('[network] node public-ip', ip);
            this.nodePublicIp = ip;
            return this._initializeServer().then(() => {
                eventBus.emit('network_ready');
                task.scheduleTask('network-reconnect', () => this.retryConnectToInactiveNodes(), 10000);
            }).catch(e => console.log('[network] err', e));
        }).catch(() => {
            setTimeout(() => this.initialize(), 1000);
        });
    }

    stopWebSocket() {
        const wss = this.getWebSocket();
        if (wss) {
            wss._server && wss._server.close();
            wss.close();
        }
    }

    stop() {
        eventBus.removeAllListeners('node_handshake');
        task.removeTask('network-reconnect');

        this.initialized = false;
        this.stopWebSocket();

        // disconnect websocket and clean global registry
        _.each(_.keys(this._nodeRegistry), id => _.each(this._nodeRegistry[id], ws => ws && ws.close && ws.close()));
        this._nodeRegistry       = {};
        // clean connection registry
        this._connectionRegistry = {};
    }
}


export default new Network();
