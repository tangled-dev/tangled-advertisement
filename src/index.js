import logger from './core/logger';
import service from './core/service';
import config from './config/config';

const argv = require('yargs')
    .options({
        'initial-peers': {
            demandOption: false,
            array       : true
        },
        'nat-pmp'      : {
            type   : 'boolean',
            default: true
        }
    }).argv;

if (argv.initialPeers) {
    config.NODE_INITIAL_LIST = argv.initialPeers.map(e => {
        const part = e.split(':');
        return {
            host: part[0],
            port: parseInt(part[1])
        };
    });
}

if (argv.bind) {
    config.NODE_BIND_IP = argv.bind;
}

if (argv.port) {
    config.NODE_PORT = argv.port;
}

if (argv.portApi) {
    config.NODE_PORT_API = argv.portApi;
}

if (argv.host) {
    config.NODE_HOST = argv.host;
}

if (argv.hostForce) {
    config.NODE_HOST_FORCE = argv.hostForce;
}

if (argv.dataFolder) {
    config.DATABASE_CONNECTION.FOLDER = argv.dataFolder;
    config.NODE_KEY_PATH              = argv.dataFolder + 'node.json';
    config.NODE_CERTIFICATE_KEY_PATH  = argv.dataFolder + 'node_certificate_key.pem';
    config.NODE_CERTIFICATE_PATH      = argv.dataFolder + 'node_certificate.pem';
}

if (argv.debug === 'true') {
    config.MODE_DEBUG = true;
}

if (!argv.natPmp) {
    config.NODE_NAT_PMP = false;
}

logger.log('tangled advertisement initializing');

service.initialize();
//eventBus.on('tangled_event_log', e => console.log('[log]', e))
