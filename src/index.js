import logger from './core/logger';
import service from './core/service';
import config from './config/config';
import console from './core/console';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

let pidFile      = argv.pidFile;
const dataFolder = argv.dataFolder ?
                   path.isAbsolute(argv.dataFolder) ? argv.dataFolder : path.join(os.homedir(), argv.dataFolder)
                                   : undefined;

if (dataFolder) {
    config.DATABASE_CONNECTION.FOLDER = dataFolder;
    config.NODE_KEY_PATH              = path.join(dataFolder, 'node.json');
    config.NODE_CERTIFICATE_KEY_PATH  = path.join(dataFolder, 'node_certificate_key.pem');
    config.NODE_CERTIFICATE_PATH      = path.join(dataFolder, 'node_certificate.pem');
}

if (pidFile && !path.isAbsolute(pidFile)) {
    pidFile = dataFolder ? path.join(dataFolder, pidFile) : path.join(os.homedir(), pidFile);
}


if (argv.debug === 'true') {
    config.MODE_DEBUG = true;
}

if (!argv.natPmp) {
    config.NODE_NAT_PMP = false;
}

process.title = 'tangled-advertisement';

let shutdown = false;
process.on('SIGINT', async function() {
    if (!shutdown) {
        shutdown = true;
        console.log('\n[main] gracefully shutting down from SIGINT (Crtl-C)');
        if (pidFile && fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
        }
        process.exit(0);
    }
});

const checkPIDFile = () => {
    if (!pidFile) {
        console.log('pid file not in use');
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        if (!fs.existsSync(pidFile)) {
            fs.writeFile(pidFile, process.pid, () => {
                resolve();
            });
            return;
        }

        fs.readFile(pidFile, 'utf-8', (err, data) => {
            let pid           = parseInt(data);
            let processKilled = false;
            if (Number.isInteger(pid)) {
                try {
                    process.kill(pid);
                }
                catch (ignore) {
                }
                processKilled = true;
                console.log('zombie process killed, pid:', pid);
            }
            fs.writeFile(pidFile, process.pid, () => {
                setTimeout(() => resolve(), processKilled ? 1000 : 0);
            });
        });
    });
};

logger.log('tangled advertisement initializing');

checkPIDFile().then(() => service.initialize());
