const _ = require('lodash');
const logger = require('../utils/logger');

const pancake = require('../services/pancake');
const coinbase = require('../services/coinbase');
const web3Service = require('../services/web3');
const tonService = require('../services/ton');
const db = require('../models/db');
const User = require('../models/user');
const {REFER_NRFX_ACCRUAL} = require('../const');
const getCommission = require('../utils/getCommission');
const {rates} = require('../models/cache');

const errors = require('../models/error');

const getFiatToTokenRate = async (fiat, token = 'nrfx', tokenNetwork = 'BEP20') => {
    try {
        const data = await Promise.all([
            rates.get(fiat.toLowerCase()),
            rates.get(token.toLowerCase()),
        ]);
        return data[1] / data[0];
    } catch (error) {
        logger.error('[getFiatToTokenRate]', error);
        throw error;
    }
};

/**
 * Estimate a transfer gas when the logic sending tokens from default account to a user
 * @param user
 * @param amount
 * @param token
 * @param tokenNetwork
 * @returns {Promise.<{gas: *, gasGwei: number, gasInTokens: number}>}
 */
const estimateTransferToUserGas = async (user, amount, token = 'nrfx', tokenNetwork = 'BEP20') => {
    try {
        const wallet = user.wallets.find(w => w.data.network === tokenNetwork);
        if (!wallet) throw new errors.NoWalletsError();
        const {address} = wallet.data;

        if (tokenNetwork === 'TON') {
            const data = await tonService.estimateGas(address, amount);
            const fee = _.get(data, 'source_fees.gas_fee', 0);
            const feeAmount = tonService.tonweb.utils.fromNano(fee);
            return {
                gas: feeAmount,
                gasGwei: fee,
                gasInTokens: feeAmount,
            };
        } else {
            const data = await Promise.all([
                web3Service.estimateGas(address, token, amount),
                pancake.getTokenBNBPrice(token, tokenNetwork),
            ]);
            const gwei = Number(web3Service.fromGwei(data[0]));
            return {
                gas: data[0],
                gasGwei: gwei, // BNB amount
                gasInTokens: gwei / Number(data[1]), // Gas price expressed in tokens
            };
        }
    } catch (error) {
        if (_.includes(error.message, 'subtraction overflow')) {
            throw new errors.MasterAccountEmptyError();
        }

        logger.error('[estimateTransferGas]', error);
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
                                   }) => {
    // Check current transfer is still in progress
    if (user.isTransfersLocked) throw new errors.TransfersLockedError();
    // Lock other transfers
    user.isTransfersLocked = true;

    let tokenNetwork;
    switch (token) {
        case 'ton':
            tokenNetwork = 'TON';
            break;
        default:
            tokenNetwork = 'BEP20';
    }
    logger.info('[swapFiatToToken] Start transfer for', user.login, fiat, token, fiatAmount, tokenNetwork);

    try {
        //Get rate and user balance
        const data = await Promise.all([
            getFiatToTokenRate(fiat, token, tokenNetwork),
            user.getFiats(),
            db.getSiteSettings(),
        ]);
        const rate = data[0];
        const fiats = data[1].map(fiat => {
            delete fiat.userID;
            delete fiat.locked;
            return fiat;
        });

        let commissions = data[2];
        try {
            commissions = JSON.parse(commissions);
        } catch (error) {
            logger.warn('Commissions in not JSON format', data[2]);
        }

        const commission = getCommission(commissions, token);
        let tokenAmount = fiatAmount / rate;
        const fiatKey = fiat.toLowerCase();

        // Apply commission
        tokenAmount -= tokenAmount * commission;

        // Subtract a gas price expressed in tokens from the token amount
        const gasData = await estimateTransferToUserGas(user, tokenAmount, token, tokenNetwork);

        tokenAmount -= gasData.gasInTokens;

        // Clear too long decimals
        tokenAmount = Number(tokenAmount.toFixed(8));

        const fiatBalance = fiats.find(row => row.currency === fiatKey);
        if (!fiatBalance) throw new errors.FiatNotFoundError();
        logger.info('fiatBalance', fiatBalance);

        // Check current fiat amount
        const balance = fiatBalance.amount;
        if (balance < fiatAmount) throw new errors.NotEnoughBalanceError();

        // Get user crypto wallet address
        const wallet = user.wallets.find(w => w.data.network === tokenNetwork);
        if (!wallet) throw new errors.NoWalletsError();
        const address = wallet.data.address;

        // Withdraw fiats from the user balance
        await user.decreaseFiatBalance(fiatKey, fiatAmount);
        fiatBalance.amount -= fiatAmount;
        // Send to stream
        user.sendJson({
            type: 'fiats',
            data: fiats,
        });

        logger.info('[swapFiatToToken] Transfer confirmed', user.login, fiat, fiatAmount, token, tokenAmount);
        try {
            // Transfer tokens to the user wallet
            switch (tokenNetwork) {
                case 'TON':
                    await tonService.transfer(
                        address,
                        tokenAmount,
                        `Swap ${fiatAmount.toFixed(2)} ${fiat.toUpperCase()} to ${tokenAmount} ${token.toUpperCase()} on Narfex`,
                    );
                    break;
                case 'BEP20':
                default:
                    await web3Service.transfer(
                        address,
                        token,
                        tokenAmount,
                    );
            }
        } catch (error) {
            // Return fiats to the user balance
            await user.increaseFiatBalance(fiatKey, fiatAmount);
            fiatBalance.amount += fiatAmount;
            // Send to stream
            user.sendJson({
                type: 'fiats',
                data: fiats,
            });
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

        // Send a new balance
        user.sendJson({
            type: 'balance',
            data: await user.getWallet(address).getBalances(),
        });

        // Send referral accrual to agent
        if (token === 'nrfx') {
            (async () => {
                try {
                    const {refer} = user;
                    const agentID = Number(refer);
                    if (agentID) {
                        // Get refer agent
                        const agent = await User.getByID(agentID);
                        if (!agent) return;

                        // Get user crypto wallet address
                        const agentWallet = agent.wallets[0];
                        const agentAddress = _.get(agentWallet, 'data.address');
                        if (!agentAddress) throw new errors.NoWalletsError();

                        const accrual = tokenAmount * REFER_NRFX_ACCRUAL;

                        // Transfer tokens to the user wallet
                        await web3Service.transfer(
                            agentAddress,
                            token,
                            accrual,
                        );

                        await db.addReferProfit({
                            agentID,
                            referID: user.id,
                            amount: accrual,
                            currency: token,
                        });

                        // Send a messages to agent
                        const agentBalances = await agentWallet.getBalances();
                        // Send websocket messages
                        agent.sendJson({
                            type: 'referBonus',
                            data: {
                                amount: accrual,
                                currency: token,
                            },
                        });
                        agent.sendJson({
                            type: 'balance',
                            data: agentBalances,
                        });
                    }
                } catch (error) {
                    logger.warn("[swapFiatToToken] Can't send referral accrual to agent", error);
                }
            })();
        }

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
    estimateTransferToUserGas,
};
