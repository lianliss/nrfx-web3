const web3Service = require('../services/web3');
const tonService = require('../services/ton');

/**
 * Get right network service
 * @param network
 * @returns {*}
 */
const getService = network => {
    let service;
    switch (network) {
        case 'TON':
            service = tonService;
            break;
        case 'BSC':
        case 'BEP20':
        default:
            service = web3Service;
    }
    return service;
};

module.exports = {getService};
