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
const getCommission = (commissions, token, isFiat = false) => {
    if (token === 'referral') {
        return evaluate(commissions[token] || DEFAULT_REFERRAL_PERCENT) / 100;
    }
    const defaultCommission = isFiat
        ? commissions.FiatDefault
        : commissions.BinanceDefault;
    let commission;
    if (typeof commissions[token] !== 'undefined') {
        commission = evaluate(commissions[token] || 0) / 100;
    } else {
        const binanceToken = `${token.toUpperCase()}USDT`;
        if (typeof commissions[binanceToken] !== 'undefined') {
            commission = evaluate(commissions[binanceToken] || 0) / 100;
        } else {
            commission = evaluate(defaultCommission || 0) / 100;
        }
    }
    const contractCommission = CONTRACTS_COMMISSIONS[token] || 0;

    return commission + contractCommission;
};

module.exports = getCommission;
