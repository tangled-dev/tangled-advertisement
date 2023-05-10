import Endpoint from '../endpoint';
import network from '../../network/network';
import ntp from '../../core/ntp';
import _ from 'lodash';


/**
 * api node_connection_list
 */
class _OM11pRn90GhpfYrr extends Endpoint {
    constructor() {
        super('OM11pRn90GhpfYrr');
    }

    /**
     * list node connection
     * @param app
     * @param req
     * @param res
     * @returns {*}
     */
    handler(app, req, res) {
        const nodeOnlineList    = _.keys(network.getNodeListOnline());
        const nodeConnectedList = _.uniqBy(network.registeredClients.map(ws => ({
            node_prefix       : ws.nodePrefix,
            node_address      : ws.nodeIPAddress,
            node_port         : parseInt(ws.nodePort),
            node_port_api     : parseInt(ws.nodePortApi),
            node_id           : ws.nodeID,
            connection_date   : ws.createTime,
            last_message_date : ws.lastMessageTime,
            last_message_delay: ws.lastMessageDelay
        })), 'node_id');
        res.send({
            network                  : {
                advertisement_provider: network.advertisementProvider,
                is_valid_ip           : network.isValidIp,
                public_ip             : network.nodePublicIp,
                ntp_offset            : ntp.offset,
                ntp_time              : ntp.now()
            },
            node_connected           : {
                count    : nodeConnectedList.length,
                node_list: nodeConnectedList
            },
            node_online_not_connected: {
                count    : nodeOnlineList.length,
                node_list: nodeOnlineList
            }
        });
    }
}


export default new _OM11pRn90GhpfYrr();
