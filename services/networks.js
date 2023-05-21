const web3Service = require('../services/web3');

/**
 * Get right network service
 * @param network
 * @returns {*}
 */
const getService = network => {
    let service;
    switch (network) {
        case 'BSC':
        case 'BEP20':
        default:
            service = web3Service[network];
    }
    return service;
};

module.exports = {getService};
