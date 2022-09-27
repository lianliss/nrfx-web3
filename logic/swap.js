const _ = require('lodash');
const logger = require('../utils/logger');

const pancake = require('../services/pancake');
const web3Service = require('../services/web3');
const tonService = require('../services/ton');
const db = require('../models/db');
const User = require('../models/user');
const {REFER_NRFX_ACCRUAL, FIAT_FACTORY, ZERO_ADDRESS, EXCHANGE_ROUTER} = require('../const');
const getCommission = require('../utils/getCommission');
const {rates} = require('../models/cache');
const {binance} = require('../services/binance');
const telegram = require('../services/telegram');
const wei = require('../utils/wei');
const wait = require('../utils/timeout');
const bep20TokenABI = require('../const/ABI/bep20Token');
const fiatFactoryABI = require('../const/ABI/fiatFactory');
const fiatABI = require('../const/ABI/fiat');
const exchangeRouterABI = require('../const/ABI/exchangeRouter');

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

async function getTokenPrice(tokenSymbol, isFiat = false) {
  try {
    let price;
    switch (tokenSymbol) {
      case 'NRFX': price = await rates.get('nrfx'); break;
      case 'USDT':
      case 'USD': price = 1; break;
      default: price = isFiat
        ? await rates.get(tokenSymbol.toLowerCase())
        : await rates.get(`${tokenSymbol.toUpperCase()}USDT`);
    }
    telegram.log(`[getTokenPrice] ${tokenSymbol} ${isFiat} ${price.toFixed(4)}`);
    return price;
  } catch (error) {
    logger.error('[getTokenPrice]', tokenSymbol, isFiat, error);
    telegram.log(`[getTokenPrice] ${tokenSymbol} ${isFiat} ${error.message}`);
    return 0;
  }
}

/**
 * Calculate coin amount based on fiat amount
 * @param fiat {string} fiat symbol uppercase
 * @param coin {string} coin symbol uppercase
 * @param fiatAmount {number} amount of fiat
 * @param decimals {int} amount of decimals (optional) (default: 8)
 * @param _commissions {object} commissions object (optional)
 * @returns {Promise.<{fiatPrice: *, coinPrice: *, fiatCommission: number, coinCommission: *, rate: number, coinAmount: number, usdtAmount: number}>}
 */
const getCoinAmount = async (fiatContract, coinContract, fiatAmount, decimals = 8, _commissions) => {
  try {
    const fiatSymbol = fiatContract.symbol;
    const coinSymbol = coinContract.symbol;
    const prices = await Promise.all([
      getTokenPrice(fiatSymbol, fiatContract.isFiat),
      getTokenPrice(coinSymbol, coinContract.isFiat),
    ]);
    const fiatPrice = prices[0];
    const coinPrice = prices[1];
    logger.debug('getCoinAmount', fiatSymbol, coinSymbol, fiatAmount, prices);

    // Request commissions if it's undefined
    let commissions = _commissions;
    if (!commissions) {
      commissions = (await db.getSiteSettings()).commissions;
      try {
        commissions = JSON.parse(commissions);
      } catch (error) {
        logger.warn('Commissions in not JSON format', commissions);
      }
    }

    const fiatCommission = (Number(_.get(commissions, `${fiatSymbol.toLowerCase()}`, 0)) || 0) / 100;
    const coinCommission = getCommission(commissions, coinSymbol.toLowerCase());
    const rate = (fiatPrice * (1 - fiatCommission)) / coinPrice;

    // Calculate coin amount
    let coinAmount = fiatAmount * rate * (1 - coinCommission);
    coinAmount = Number(coinAmount.toFixed(decimals)); // Round value
    let usdtAmount = coinSymbol === 'USDT' ? coinAmount : coinAmount * coinPrice;
    usdtAmount = Number(usdtAmount.toFixed(decimals)); // Round value

    return {
      fiatPrice, coinPrice,
      fiatCommission, coinCommission,
      rate,
      coinAmount, usdtAmount,
    };
  } catch (error) {
    logger.error('[getCoinAmount]', error);
    telegram.log(`[getCoinAmount] Error ${error.message}`);
    throw error;
  }
};

const mintFiatBackToAddress = async (fiat, accountAddress, burned) => {
  try {
    // Get fiat
    const factoryContract = new (web3Service.web3.eth.Contract)(
      require('../const/ABI/fiatFactory'),
      FIAT_FACTORY,
    );
    const fiatAddress = await factoryContract.methods.fiats(fiat.toUpperCase()).call();
    if (fiatAddress === ZERO_ADDRESS) throw new Error(`NarfexFiat for ${fiat} is not deployed yet`);
    const fiatContract = new (web3Service.web3.eth.Contract)(
      require('../const/ABI/fiat'),
      fiatAddress,
    );
    const mintReceipt = await web3Service.transaction(fiatContract, 'mintTo', [
      accountAddress,
      wei.to(burned),
    ]);
    logger.debug('minted', burned, fiat, 'on', accountAddress);
    telegram.log(`[exchange] <a href="https://bscscan.com/tx/${burnReceipt.transactionHash}">Mint</a>
 <b>${burned}</b> ${fiat} to ${accountAddress}`);
    return mintReceipt;
  } catch (error) {
    logger.error(`[mintFiatBackToAddress] Error ${burned.toFixed(4)} ${fiat} ${accountAddress}`, error);
    telegram.log(`[mintFiatBackToAddress] Error ${burned.toFixed(4)} ${fiat} ${accountAddress}: ${error.message}`);
  }
};

const getBinanceBalance = async () => {
  try {
    const data = await Promise.all([
      web3Service.getDefaultAccountBalances(),
      binance.updateBalance(),
    ]);
    const usdt = binance.coins.find(c => c.coin === 'USDT');
    const usdtBalance = _.get(usdt, 'balance', 0);
    const balance = data[0];
    return {
      bnb: wei.from(balance.bnb),
      nrfx: wei.from(balance.nrfx),
      usdt: usdtBalance,
    };
  } catch (error) {
    logger.error('[getBinanceBalance]', error);
    telegram.log(`[getBinanceBalance] Error ${error.message}`);
  }
};
telegram.narfexLogic.getBinanceBalance = getBinanceBalance;

/**
 * Returns token contract
 * @param token {string} tokenAddress or tokenSymbol
 * @returns {Promise.<web3Service.web3.eth.Contract>}
 */
const getTokenContract = async token => {
  try {
    const factoryContract = new (web3Service.web3.eth.Contract)(
      fiatFactoryABI,
      FIAT_FACTORY,
    );
    const isAddress = web3Service.web3.utils.isAddress(token);
    let tokenAddress;
    if (isAddress) {
      // If token === tokenAddress
      tokenAddress = token;
      const fiats = await factoryContract.methods.getFiats().call();
      const isFiat = _.includes(fiats, tokenAddress);
      const tokenABI = isFiat ? fiatABI : bep20TokenABI;
      const tokenContract = new (web3Service.web3.eth.Contract)(
        tokenABI,
        tokenAddress,
      );
      tokenContract.isFiat = isFiat;
      tokenContract.symbol = await tokenContract.methods.symbol().call();
      return tokenContract;
    } else {
      // If token === tokenSymbol
      tokenAddress = await factoryContract.methods.fiats(token.toUpperCase()).call();
      if (tokenAddress === ZERO_ADDRESS) {
        throw new Error(`NarfexFiat for ${token} is not deployed yet`);
      } else {
        const fiatContract = new (web3Service.web3.eth.Contract)(
          fiatABI,
          tokenAddress,
        );
        fiatContract.isFiat = true;
        fiatContract.symbol = token;
        return fiatContract;
      }
    }
  } catch (error) {
    logger.error('[getTokenContract]', error.message);
    throw error;
  }
};

const exchangeFiatToCrypto = async (accountAddress,
                                    fiatContract,
                                    coinContract,
                        amount,
                        fiatToBNBAmount = 0,
                        ) => {
  let burned = 0;
  try {
    const fiatSymbol = fiatContract.symbol;
    const coinSymbol = coinContract.symbol;

    telegram.log(`exchange ${fiatContract.symbol} ${fiatContract.isFiat} ${coinContract.symbol} ${coinContract.isFiat}`);

    const fiatBalance = wei.from(await fiatContract.methods.balanceOf(accountAddress).call());
    telegram.log(`fiatBalance ${fiatBalance.toFixed(5)}`);

    // Get Binance account balance
    const data = await Promise.all([
      binance.updateBalance(),
      db.getSiteSettings(),
    ]);
    const limits = binance.coins.find(c => c.coin === coinSymbol);
    const usdt = binance.coins.find(c => c.coin === 'USDT');
    const minCoinAmount = _.get(limits, 'min', 0);
    const maxCoinAmount = _.get(limits, 'max', Infinity);
    const minDecimals = _.get(limits, 'minDecimals', 0.0000000001);
    const exchangeData = binance.exchangeData.symbols.find(s => s.symbol === `${coinSymbol}USDT`);
    const decimals = _.get(exchangeData, 'baseAssetPrecision', 8);
    const coinBalance = _.get(limits, 'balance', 0);
    const usdtBalance = _.get(usdt, 'balance', 0);

    let fiatAmount = Number(amount) || 0;
    if (fiatToBNBAmount) {
      fiatAmount -= fiatToBNBAmount;
    }

    // Get commission
    let commissions = data[1].commissions;
    try {
      commissions = JSON.parse(commissions);
    } catch (error) {
      logger.warn('Commissions in not JSON format', commissions);
    }

    // Get prices
    let {
      fiatPrice, coinPrice,
      fiatCommission, coinCommission,
      rate,
      coinAmount, usdtAmount,
    } = await getCoinAmount(fiatContract, coinContract, fiatAmount, decimals, commissions);

    logger.debug('[exchange] Details', {
      fiatCommission,
      coinCommission,
      rate,
      fiatAmount,
      coinAmount,
      usdtAmount,
      decimals,
    });
    telegram.log(`[exchange] Details:
${accountAddress}
<b>User balance:</b> ${fiatBalance.toFixed(2)} ${fiatSymbol}
<b>From amount:</b> ${fiatAmount.toFixed(2)} ${fiatSymbol}
<b>To amount:</b> ${coinAmount.toFixed(2)} ${coinSymbol}
<b>Equivalently:</b> ${usdtAmount.toFixed(2)} USDT
<b>Binance USDT balance:</b> ${usdtBalance} USDT
<b>Fiat commission:</b> ${fiatCommission * 100}%
<b>Rate:</b> ${rate.toFixed(5)}
<b>Coin commission:</b> ${coinCommission * 100}%
<b>Minimum:</b> ${minCoinAmount.toFixed(2)} ${coinSymbol} 
`);

    // limits
    if (coinAmount < minCoinAmount) throw new Error(`Coin amount is less than minimum`);
    if (coinAmount > maxCoinAmount) throw new Error('Coin amount is more than maximum');
    if (usdtAmount > usdtBalance && coin !== 'NRFX') throw new Error(`Overload error. Try again in 5 minutes or text to Support`);
    if (fiatAmount > fiatBalance) throw new Error('Not enough fiat balance');

    const exchangeId = `exchange-${fiatSymbol}-${coinSymbol}-${Date.now()}`;

    // Burn
    const burnReceipt = await web3Service.transaction(fiatContract, 'burnFrom', [
      accountAddress,
      wei.to(fiatAmount + fiatToBNBAmount),
    ]);
    burned = fiatAmount + fiatToBNBAmount;
    telegram.log(`[exchange] <a href="https://bscscan.com/tx/${burnReceipt.transactionHash}">Burn</a>
 <b>${burned}</b> ${fiatSymbol} from ${accountAddress}`);

    // Swap on Binance
    if (coinSymbol !== 'USDT' && coinSymbol !== 'NRFX') {
      const swapResult = await binance.spotSwap(
        `${coinSymbol}USDT`,
        usdtAmount,
        exchangeId,
      );
      logger.debug('swapResult', swapResult);
      usdtAmount = Number(swapResult.cummulativeQuoteQty);
      coinAmount = Number(swapResult.executedQty);
      // Lower amount by 0.3% to avoid insufficient balance error
      //coinAmount = Math.floor(coinAmount * 0.997 / minDecimals) * minDecimals; // Round value
      telegram.log(`[exchange] Swap <b>${usdtAmount}</b> USDT to <b>${coinAmount}</b> ${coinSymbol}`);
    }

    // Send coins to user
    let txHash;
    if (coinSymbol !== 'NRFX') {
      await wait(10000); // Wait after swap
      const withdrawId = await binance.applyWithdraw(
        coinSymbol,
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
 <a href="https://bscscan.com/tx/${txHash || ''}"><b>${withdraw.status}</b></a>`);
    } else {
      // Send NARFEX
      try {
        await wait(5000);
        const result = await web3Service.transfer(
          accountAddress,
          'nrfx',
          coinAmount,
        );
        txHash = _.get(result, 'receipt.transactionHash');
        telegram.log(`[exchange] Transfer <b>${coinAmount.toFixed(5)}</b> NRFX
 to ${accountAddress} [<a href="https://bscscan.com/address/${accountAddress}">Scan</a>]
 <a href="https://bscscan.com/tx/${txHash || ''}"><b>View details</b></a>`);
      } catch (error) {
        logger.error('[exchange] Transfer ERROR', error);
        telegram.log(`[exchange] Transfer ERROR <b>${coinAmount}</b> NRFX: ${error.message}`);
        throw new Error(error.message);
      }
    }

    if (fiatToBNBAmount) {
      try {
        const bnbOperation = await getCoinAmount(
          fiatContract,
          'BNB',
          fiatToBNBAmount,
          decimals,
          commissions);
        const bnbAmount = bnbOperation.coinAmount;
        await wait(5000);
        const bnbResult = await web3Service.transfer(
          accountAddress,
          'bnb',
          bnbAmount,
        );
        const bnbHash = _.get(bnbResult, 'receipt.transactionHash');
        telegram.log(`[exchange] Transfer <b>${bnbAmount.toFixed(5)}</b> BNB
 to ${accountAddress} [<a href="https://bscscan.com/address/${accountAddress}">Scan</a>]
 <a href="https://bscscan.com/tx/${bnbHash || ''}"><b>View details</b></a>`);
      } catch (error) {
        logger.error(`[exchange] Can't send ${fiatToBNBAmount} BNB to ${accountAddress}`, error);
        telegram.log(`[exchange] Can't send ${fiatToBNBAmount} BNB to ${accountAddress}: ${error.message}`);
        mintFiatBackToAddress(fiatSymbol, accountAddress, fiatToBNBAmount);
      }
    }

    return {txHash};
  } catch (error) {
    logger.error(`[SwapLogic][exchangeFiatToCrypto] Error ${accountAddress} ${amount} ${fiatContract.symbol} to ${coinContract.symbol} `, error);
    telegram.log(`[SwapLogic][exchangeFiatToCrypto] Error ${accountAddress} ${amount} ${fiatContract.symbol} to ${coinContract.symbol} 
    (${_.get(error, 'data.code', error.name).code}) ${_.get(error, 'data.msg', error.message)}`);
    throw error;
  }
};

const exchange = async (accountAddress,
                        fiat,
                        coin,
                        amount,
                        fiatToBNBAmount = 0,
) => {
  try {
    const contracts = await Promise.all([
      getTokenContract(fiat),
      getTokenContract(coin),
    ]);
    const routerContract = new (web3Service.web3.eth.Contract)(
      exchangeRouterABI,
      FIAT_FACTORY,
    );
    const fiatContract = contracts[0];
    const coinContract = contracts[1];
    const fiatSymbol = fiatContract.symbol;
    const coinSymbol = coinContract.symbol;

    if (fiatContract.isFiat && !coinContract.isFiat) {
      // Use Binance
      return await exchangeFiatToCrypto(accountAddress, fiatContract, coinContract, amount, fiatToBNBAmount);
    }

    const method = fiatContract.isFiat
      ? 'exchangeFiatToFiat'
      : 'exchangeCryptoToFiat';

    const fiatBalance = wei.from(await fiatContract.methods.balanceOf(accountAddress).call());
    telegram.log(`fiatBalance ${fiatBalance.toFixed(5)}`);

    let fiatAmount = Number(amount) || 0;
    if (fiatAmount > fiatBalance) throw new Error('Not enough fiat balance');

    // Get commission
    let commissions = (await db.getSiteSettings()).commissions;
    try {
      commissions = JSON.parse(commissions);
    } catch (error) {
      logger.warn('Commissions in not JSON format', commissions);
    }

    // Get prices
    let {
      fiatPrice, coinPrice,
      fiatCommission, coinCommission,
      rate,
      coinAmount, usdtAmount,
    } = await getCoinAmount(fiatContract, coinContract, fiatAmount, undefined, commissions);

    logger.debug('[exchange] Details', {
      fiatCommission,
      coinCommission,
      rate,
      fiatAmount,
      coinAmount,
      usdtAmount,
    });
    telegram.log(`[exchange] Details:
${accountAddress}
<b>User balance:</b> ${fiatBalance.toFixed(2)} ${fiatSymbol}
<b>From amount:</b> ${fiatAmount.toFixed(2)} ${fiatSymbol}
<b>To amount:</b> ${coinAmount.toFixed(2)} ${coinSymbol}
<b>Equivalently:</b> ${usdtAmount.toFixed(2)} USDT
<b>Fiat commission:</b> ${fiatCommission * 100}%
<b>Rate:</b> ${rate.toFixed(5)}
<b>Coin commission:</b> ${coinCommission * 100}% 
`);

    const receipt = await web3Service.transaction(routerContract, method, [
      accountAddress,
      fiatContract.options.address,
      coinContract.options.address,
      wei.to(fiatAmount),
      wei.to(coinAmount),
    ]);
    const txHash = _.get(receipt, 'transactionHash');
    telegram.log(`[exchange] ${method}\n`
      + `<b>Account: </b><code>${accountAddress}</code>\n`
      + `<b>From: </b> ${fiatAmount.toFixed(5)} ${fiatSymbol}\n`
      + `<b>To: </b> ${coinAmount.toFixed(5)} ${coinSymbol}\n`
      + `<b>Equivalently:</b> ${usdtAmount.toFixed(2)} USDT\n`
      + `<a href="https://bscscan.com/tx/${txHash || ''}"><b>View details</b></a>`);
    return txHash;
  } catch (error) {
    logger.error(`[SwapLogic][exchange] Error ${accountAddress} ${amount} ${fiat} to ${coin} `, error);
    telegram.log(`[SwapLogic][exchange] Error ${accountAddress} ${amount} ${fiat} to ${coin} 
    (${_.get(error, 'data.code', error.name).code}) ${_.get(error, 'data.msg', error.message)}`);
    throw error;
  }
};

module.exports = {
  getFiatToTokenRate,
  swapFiatToToken,
  estimateTransferToUserGas,
  exchange,
};
