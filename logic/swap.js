const _ = require('lodash');
const logger = require('../utils/logger');

const pancake = require('../services/pancake');
const coinbase = require('../services/coinbase');
const web3Service = require('../services/web3');
const db = require('../models/db');

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

/**
 * Swap user's fiat to cryptocurrency
 * @param user
 * @param fiat
 * @param token
 * @param fiatAmount
 * @param tokenNetwork
 * @returns {Promise.<*>}
 */
const swapFiatToToken = async ({
    user,
    fiat,
    token = 'nrfx',
    fiatAmount,
    tokenNetwork = 'BEP20',
                                   }) => {
    // Check current transfer is still in progress
    if (user.isTransfersLocked) throw new errors.TransfersLockedError();
    // Lock other transfers
    user.isTransfersLocked = true;
    logger.info('[swapFiatToToken] Start transfer for', user.login, fiat, token, fiatAmount, tokenNetwork);

    try {
        //Get rate and user balance
        const data = await Promise.all([
            getFiatToTokenRate(fiat, token, tokenNetwork),
            user.getFiats(),
        ]);
        const rate = data[0];
        const tokenAmount = fiatAmount / rate;
        const fiatKey = fiat.toLowerCase();

        const fiatBalance = data[1].find(row => row.currency === fiatKey);
        if (!fiatBalance) throw new errors.FiatNotFoundError();
        logger.info('fiatBalance', fiatBalance);

        // Check current fiat amount
        const balance = fiatBalance.amount;
        if (balance < fiatAmount) throw new errors.NotEnoughBalanceError();

        // Get user crypto wallet address
        const address = _.get(user, 'wallets[0].data.address');
        if (!address) throw new errors.NoWalletsError();

        // Withdraw fiats from the user balance
        await user.decreaseFiatBalance(fiatKey, fiatAmount);

        logger.info('[swapFiatToToken] Transfer confirmed', user.login, fiat, fiatAmount, token, tokenAmount);
        try {
            // Transfer tokens to the user wallet
            await web3Service.transferFromDefault(
                address,
                token,
                tokenAmount,
            );
        } catch (error) {
            // Return fiats to the user balance
            await user.increaseFiatBalance(fiatKey, fiatAmount);
            throw error;
        }

        // Unlock transfers
        user.isTransfersLocked = false;

        // Update history
        await db.addHistoryExchange({
            userID: user.id,
            fromBalance: fiatBalance.id,
            amount: fiatAmount,
            extra: {
                fiat_amount: fiatAmount,
                from_currency: fiatKey,
                to_currency: token,
                crypto_amount: tokenAmount,
                price: rate,
            },
        });
        return {
            rate,
            tokenAmount,
            fiatAmount,
        }
    } catch (error) {
        // Unlock transfers
        user.isTransfersLocked = false;
        logger.error('[swapFiatToToken]', user.login, fiat, token, fiatAmount, error);
        throw error;
    }
};

module.exports = {
    getFiatToTokenRate,
    swapFiatToToken,
};
