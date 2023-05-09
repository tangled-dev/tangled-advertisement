import Endpoint from '../endpoint';
import network from '../../network/network';


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
            node_prefix      : ws.nodePrefix,
            node_address     : ws.nodeIPAddress,
            node_port        : parseInt(ws.nodePort),
            node_port_api    : parseInt(ws.nodePortApi),
            node_id          : ws.nodeID,
            connection_date  : ws.createTime,
            last_message_date: ws.lastMessageTime
        })), 'node_id');
        res.send({
            advertisement_provider: network.advertisementProvider,
            node_connected        : {
                count    : nodeConnectedList.length,
                node_list: nodeConnectedList
            },
            node_online           : {
                count    : nodeOnlineList.length,
                node_list: nodeOnlineList
            }
        });
    }
}


export default new _OM11pRn90GhpfYrr();
