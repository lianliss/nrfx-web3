const {evaluate} = require('mathjs');

const CONTRACTS_COMMISSIONS = {
    //nrfx: 0.02,
};

/**
 * Get token commission
 * @param commissions {object}
 * @param token {string} - token name in lowercase
 * @returns {*}
 */
const getCommission = (commissions, token) => {
    const commission = (typeof commissions[token] !== 'undefined'
        ? evaluate(commissions[token] || 0)
        : evaluate(commissions.default || 0))
        / 100;
    const contractCommission = CONTRACTS_COMMISSIONS[token] || 0;

    return commission + contractCommission;
};

module.exports = getCommission;
