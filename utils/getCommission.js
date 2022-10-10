const {evaluate} = require('mathjs');
const {DEFAULT_REFERRAL_PERCENT} = require('../const');

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
    const defaultCommission = token === 'referral'
        ? DEFAULT_REFERRAL_PERCENT
        : 0;
    const commission = (typeof commissions[token] !== 'undefined'
        ? evaluate(commissions[token] || defaultCommission)
        : evaluate(commissions.default || defaultCommission))
        / 100;
    const contractCommission = CONTRACTS_COMMISSIONS[token] || 0;

    return commission + contractCommission;
};

module.exports = getCommission;
