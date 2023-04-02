const _ = require('lodash');
const logger = require('../utils/logger');

const web3Service = require('../services/web3');
const db = require('../models/db');
const {
  ZERO_ADDRESS,
} = require('../const');
const {binance} = require('../services/binance');
const telegram = require('../services/telegram');
const wei = require('../utils/wei');
const bep20TokenABI = require('../const/ABI/bep20Token');
const fiatFactoryABI = require('../const/ABI/fiatFactory');
const poolABI = require('../const/ABI/exchangerPool');
const fiatABI = require('../const/ABI/fiat');

const getPoolBalance = async (networkID = 'BSC') => {
  try {
    const pool = new (web3Service[networkID].web3.eth.Contract)(
      poolABI,
      web3Service[networkID].network.contracts.exchangePool,
    );
    return wei.from(await pool.methods.getBalance().call(), web3Service[networkID].network.fiatDecimals);
  } catch (error) {
    logger.error('[getPoolBalance]', error);
    telegram.log(`[getPoolBalance] Error ${error.message}`);
  }
};
telegram.narfexLogic.getPoolBalance = getPoolBalance;

/**
 * Returns token contract
 * @param token {string} tokenAddress or tokenSymbol
 * @returns {Promise.<web3Service.web3.eth.Contract>}
 */
const getTokenContract = async (token, networkID = 'BSC') => {
  try {
    const factoryContract = new (web3Service[networkID].web3.eth.Contract)(
      fiatFactoryABI,
      web3Service[networkID].network.contracts.fiatFactory,
    );
    const isAddress = web3Service[networkID].web3.utils.isAddress(token);
    let tokenAddress;
    if (isAddress) {
      // If token === tokenAddress
      tokenAddress = token;
      const fiats = await factoryContract.methods.getFiats().call();
      const isFiat = _.includes(fiats, tokenAddress);
      const tokenABI = isFiat ? fiatABI : bep20TokenABI;
      const tokenContract = new (web3Service[networkID].web3.eth.Contract)(
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
        const fiatContract = new (web3Service[networkID].web3.eth.Contract)(
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

const exchange = async (
  accountAddress,
  fiat,
  coin,
  fiatAmount,
  coinAmount,
  networkID,
) => {
  try {
    const data = await Promise.all([
      getTokenContract(fiat, networkID),
      getTokenContract(coin, networkID),
      getPoolBalance(networkID),
    ]);
    telegram.sendToAdmins(`<b>🚫 User failed to exchange:</b>\n`
+ `<code>${accountAddress}</code>\n`
+ `<b>From:</b> ${fiatAmount.toFixed(0)} ${data[0].symbol}\n`
+ `<b>To:</b> ${coinAmount.toFixed(0)} ${data[1].symbol}\n`
+ `<b>Pool balance:</b> ${data[2].toFixed(0)} USDC\n`, []);
  } catch (error) {
    logger.error('[exchange]', error.message);
  }
};

module.exports = {
  getTokenContract,
  getPoolBalance,
  exchange,
};
