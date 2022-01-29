const _ = require('lodash');
const logger = require('../utils/logger');

const pancake = require('../services/pancake');
const coinbase = require('../services/coinbase');
const web3Service = require('../services/web3');

const errors = require('../models/error');

const getFiatToTokenRate = async (fiat, token = 'nrfx', tokenNetwork = 'BEP20') => {
    try {
        const data = await Promise.all([
            coinbase.getFiatUSDPrice(fiat),
            pancake.getTokenUSDPrice(token, tokenNetwork),
        ]);
        return data[0] * data[1];
    } catch (error) {
        logger.error('[getFiatToTokenRate]', error);
        throw error;
    }
};

const swapFiatToToken = async ({
    user,
    fiat,
    token = 'nrfx',
    fiatAmount,
    tokenNetwork = 'BEP20',
                                   }) => {
    try {
        logger.debug('[swapFiatToToken]', user.login, fiat, token, fiatAmount, tokenNetwork);
        const data = await Promise.all([
            getFiatToTokenRate(fiat, token, tokenNetwork),
            user.getFiats(),
        ]);
        logger.debug('data', data);
        const rate = data[0];
        const tokenAmount = fiatAmount / rate;
        const fiatKey = fiat.toLowerCase();
        const fiatBalance = data[1].find(row => row.currency === fiatKey);
        if (!fiatBalance) throw new errors.FiatNotFoundError();

        const balance = fiat.amount;
        if (balance < fiatAmount) throw new errors.NotEnoughBalanceError();

        const address = _.get(user, 'wallets[0].data.address');
        if (!address) throw new errors.NoWalletsError();

        const decreaseResult = await user.decreaseFiatBalance(fiatKey, fiatAmount);
        logger.debug('tokenAmount', tokenAmount);

        await web3Service.transferFromDefault(
            address,
            token,
            tokenAmount,
        );

        return {
            rate,
            tokenAmount,
            fiatAmount,
        }
    } catch (error) {
        logger.error('[swapFiatToToken]', user.login, fiat, token, fiatAmount, error);
        return false;
    }
};

module.exports = {
    getFiatToTokenRate,
    swapFiatToToken,
};
