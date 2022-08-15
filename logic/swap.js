const _ = require('lodash');
const logger = require('../utils/logger');

const pancake = require('../services/pancake');
const coinbase = require('../services/coinbase');
const web3Service = require('../services/web3');
const tonService = require('../services/ton');
const db = require('../models/db');
const User = require('../models/user');
const {REFER_NRFX_ACCRUAL, FIAT_FACTORY, ZERO_ADDRESS} = require('../const');
const getCommission = require('../utils/getCommission');
const {rates} = require('../models/cache');
const {binance} = require('../services/binance');
const telegram = require('../services/telegram');
const wei = require('../utils/wei');
const wait = require('../utils/timeout');

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

    let commissions = data[2].commissions;
    try {
      commissions = JSON.parse(commissions);
    } catch (error) {
      logger.warn('Commissions in not JSON format', commissions);
    }

    const commission = getCommission(commissions, token);
    let tokenAmount = fiatAmount * (1 / rate) / (1 + commission);
    logger.debug('tokenAmount', `${tokenAmount} = ${fiatAmount} * (1 / ${rate}) / (1 + ${commission})`);
    const fiatKey = fiat.toLowerCase();

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
        commission,
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

const exchange = async (accountAddress,
                        fiat,
                        coin,
                        amount,) => {
  try {
    // Get fiat
    const factoryContract = new (web3Service.web3.eth.Contract)(
      require('../const/ABI/fiatFactory'),
      FIAT_FACTORY,
    );
    const fiatAddress = await factoryContract.methods.fiats(fiat.toUpperCase()).call();
    logger.debug('[SwapLogic][exchange] fiatAddress', fiat, fiatAddress);
    if (fiatAddress === ZERO_ADDRESS) throw new Error(`NarfexFiat for ${fiat} is not deployed yet`);
    const fiatContract = new (web3Service.web3.eth.Contract)(
      require('../const/ABI/fiat'),
      fiatAddress,
    );
    const fiatBalance = wei.from(await fiatContract.methods.balanceOf(accountAddress).call());
    logger.debug('fiatBalance', fiatBalance);

    // Get Binance account balance
    const data = await Promise.all([
      binance.updateBalance(),
      db.getSiteSettings(),
    ]);
    const limits = binance.coins.find(c => c.coin === coin);
    const usdt = binance.coins.find(c => c.coin === 'USDT');
    const minCoinAmount = _.get(limits, 'min', 0);
    const maxCoinAmount = _.get(limits, 'max', Infinity);
    const minDecimals = _.get(limits, 'minDecimals', 0.0000000001);
    const exchangeData = binance.exchangeData.symbols.find(s => s.symbol === `${coin}USDT`);
    const decimals = _.get(exchangeData, 'baseAssetPrecision', 8);
    const coinBalance = _.get(limits, 'balance', 0);
    const usdtBalance = _.get(usdt, 'balance', 0);
    logger.debug('coinBalance', coinBalance, 'usdtBalance', usdtBalance);

    // Get prices
    const fiatPrice = await rates.get(fiat.toLowerCase());
    let coinPrice;
    switch (coin) {
      case 'NRFX': coinPrice = await rates.get('nrfx'); break;
      case 'USDT': coinPrice = 1; break;
      default: coinPrice = await rates.get(`${coin}USDT`);
    }
    logger.debug('fiatPrice and coinPrice', fiatPrice, coinPrice);

    // Get commission
    let commissions = data[1].commissions;
    try {
      commissions = JSON.parse(commissions);
    } catch (error) {
      logger.warn('Commissions in not JSON format', commissions);
    }
    const commission = getCommission(commissions, coin.toLowerCase());
    const rate = fiatPrice / coinPrice;
    const fiatAmount = Number(amount) || 0;

    // Calculate coin amount
    let coinAmount = fiatAmount * rate * (1 - commission);
    coinAmount = Number(coinAmount.toFixed(decimals)); // Round value
    let usdtAmount = coin === 'USDT' ? coinAmount : coinAmount * coinPrice;
    usdtAmount = Number(usdtAmount.toFixed(decimals)); // Round value
    logger.debug('commissions', {
      commission,
      rate,
      fiatAmount,
      coinAmount,
      usdtAmount,
      decimals,
    });

    // limits
    if (coinAmount < minCoinAmount) throw new Error('Coin amount is less than minimum');
    if (coinAmount > maxCoinAmount) throw new Error('Coin amount is more than maximum');
    if (fiatAmount > fiatBalance) throw new Error('Not enough fiat balance');
    if (usdtAmount > usdtBalance && coin !== 'NRFX') throw new Error(`Overload error. Try again in 5 minutes or text to Support`);

    const exchangeId = `exchange-${fiat}-${coin}-${Date.now()}`;

    // Burn fiat
    const burnReceipt = await web3Service.transaction(fiatContract, 'burnFrom', [
      accountAddress,
      wei.to(fiatAmount),
    ]);
    logger.debug('burned', fiatAmount, fiat, 'on', accountAddress);
    telegram.log(`[exchange] <a href="https://bscscan.com/tx/${burnReceipt.transactionHash}">Burn</a>
 <b>${fiatAmount}</b> ${fiat} from ${accountAddress}`);

    // Swap on Binance
    if (coin !== 'USDT' && coin !== 'NRFX') {
      const swapResult = await binance.spotSwap(
        `${coin}USDT`,
        usdtAmount,
        exchangeId,
      );
      logger.debug('swapResult', swapResult);
      usdtAmount = Number(swapResult.cummulativeQuoteQty);
      coinAmount = Number(swapResult.executedQty);
      // Lower amount by 0.3% to avoid insufficient balance error
      //coinAmount = Math.floor(coinAmount * 0.997 / minDecimals) * minDecimals; // Round value
      telegram.log(`[exchange] Swap <b>${usdtAmount}</b> USDT to <b>${coinAmount}</b> ${coin}`);
    }

    // Send coins to user
    let txHash;
    if (coin !== 'NRFX') {
      await wait(2000); // Wait after swap
      const withdrawId = await binance.applyWithdraw(
        coin,
        accountAddress,
        coinAmount,
        exchangeId,
      );
      logger.debug('withdrawId', withdrawId);
      let withdraw;
      try {
        withdraw = await new Promise((fulfill, reject) => {
          binance.pendingWithdraws[exchangeId] = {
            fulfill,
            reject,
          };
          logger.debug('pendingWithdraws', exchangeId, binance.pendingWithdraws);
        });
      } catch (error) {
        withdraw = error;
        telegram.log(`[exchange] Withdraw ERROR <b>${withdraw.amount}</b> ${withdraw.coin}: ${withdraw.info}`);
        throw new Error(withdraw.info);
      }
      txHash = withdraw.txId;
      logger.debug('withdraw', withdraw);
      telegram.log(`[exchange] Withdraw <b>${withdraw.amount}</b> ${withdraw.coin}
 to <a href="https://bscscan.com/address/${withdraw.address}">${withdraw.address}</a>
 <a href="https://bscscan.com/tx/${txHash || ''}"></a><b>${withdraw.status}</b></a>`);
    } else {
      // Send NARFEX
      const result = await web3Service.transfer(
        accountAddress,
        'nrfx',
        coinAmount,
      );
      txHash = _.get(result, 'receipt.transactionHash');
    }

    return {txHash};
  } catch (error) {
    logger.error('[SwapLogic][exchange]', error);
    telegram.log(`[SwapLogic][exchange] Error (${_.get(error, 'data.code', error.name).code}) ${_.get(error, 'data.msg', error.message)}`);
    throw error;
  }
};

module.exports = {
  getFiatToTokenRate,
  swapFiatToToken,
  estimateTransferToUserGas,
  exchange,
};
