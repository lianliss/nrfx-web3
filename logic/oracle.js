const _ = require('lodash');
const logger = require('../utils/logger');
const errors = require('../models/error');
const web3Service = require('../services/web3');
const db = require('../models/db');
const {FIAT_ADDRESS, ORACLE_CONTRACT} = require('../const');
const oracleABI = require('../const/ABI/oracle');
const wei = require('../utils/wei');
const {rates} = require('../models/cache');
const telegram = require('../services/telegram');

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
let lastUpdate = Date.now();
const MAX_PERIOD = 1000 * 60 * 60; // hour
const CHECK_PERIOD = 1000 * 60 * 10; // 10 minutes
const MAX_DIFF_PERCENT = 0.5;

const updateCommissions = async dataObject => {
  try {
    db.updateCommissions(dataObject);
    const fiatDefault = Number(_.get(dataObject, 'FiatDefault', 0)) / 100;
    const coinDefault = Number(_.get(dataObject, 'BinanceDefault', dataObject.default || 0)) / 100;
    const defaultRef = 0.6 / 100;
    
    // Parse new commissions
    const fiatComm = {};
    Object.keys(FIAT_ADDRESS).map(fiat => {
      const comm = Number(_.get(dataObject, fiat.toLowerCase(), fiatDefault));
      const addr = FIAT_ADDRESS[fiat];
      if (comm !== fiatDefault) {
        fiatComm[addr.toLowerCase()] = comm / 100;
      }
    });
  
    // Oracle contract
    const oracle = new (web3Service.web3.eth.Contract)(
      oracleABI,
      ORACLE_CONTRACT,
    );
    
    // Get oracle data
    const oracleData = await Promise.all([
      oracle.methods.getSettings().call(),
      oracle.methods.getAllTokens().call(),
      oracle.methods.getPrice(WBNB).call(),
    ]);
    const oracleFiatDefault = wei.from(oracleData[0][0], 4);
    const oracleCoinDefault = wei.from(oracleData[0][1], 4);
    const oracleReferral = wei.from(oracleData[0][2], 4);
    const bnbPrice = wei.from(oracleData[2]);
    
    // Collects tokens data from oracle
    const oracleTokens = {};
    oracleData[1].map((addr, index) => {
      const tokenData = oracleData[0][3][index];
      const data = {};
      ['isFiat', 'isCustomCommission', 'isCustomReward'].map(field => {
        data[field] = !!tokenData[field];
      });
      ['commission', 'transferFee', 'reward'].map(field => {
        data[field] = wei.from(tokenData[field], 4);
      });
      oracleTokens[addr.toLowerCase()] = data;
    });
    

    // Collect updates
    const tokensToCustom = [];
    const tokensToDefault = [];
    const tokensChanged = [];
    const newValues = [];
    Object.keys(oracleTokens).map(addr => {
      const token = oracleTokens[addr];
      const newComm = fiatComm[addr];
      if (token.isCustomCommission) {
        if (typeof newComm === 'undefined') {
          tokensToDefault.push(addr);
        } else {
          if (newComm !== token.commission) {
            tokensChanged.push(addr);
            newValues.push(newComm);
          }
        }
      }
    });
    Object.keys(fiatComm).map(addr => {
      const token = oracleTokens[addr];
      const newComm = fiatComm[addr];
      if (!token || !token.isCustomCommission) {
        tokensToCustom.push(addr);
        tokensChanged.push(addr);
        newValues.push(newComm);
      }
    });
    
    // Check if need to update
    let isUpdate = fiatDefault !== oracleFiatDefault || coinDefault !== oracleCoinDefault;
    isUpdate = isUpdate || !!tokensToCustom.length || !!tokensToDefault.length || !!tokensChanged.length;
    if (!isUpdate) return;
    
    // Send transaction
    const tx = await web3Service.transaction(oracle, 'updateAllCommissions', [
      wei.to(fiatDefault, 4),
      wei.to(coinDefault, 4),
      wei.to(defaultRef, 4),
      tokensToCustom,
      tokensToDefault,
      tokensChanged,
      newValues.map(value => wei.to(value, 4)),
    ]);
    const gasUsed = Number(wei.from(tx.effectiveGasPrice.toFixed(0)) * tx.gasUsed);
    telegram.sendToAdmins(`
<b>Commissions updated</b>\n
<b>Gas used:</b> ${gasUsed.toFixed(4)} BNB ($${(gasUsed * bnbPrice).toFixed(2)})`, [
      {title: 'Transaction', url: `https://bscscan.com/tx/${tx.transactionHash}`},
    ]);
  } catch (error) {
    logger.error('[logic/oracle][updateCommissions]', error);
    telegram.log(`[logic/oracle][updateCommissions] ${error.message}`);
  }
  return;
};

const updatePrices = async () => {
  try {
    const oracle = new (web3Service.web3.eth.Contract)(
      oracleABI,
      ORACLE_CONTRACT,
    );
    const data = await Promise.allSettled([
      oracle.methods.getPrices(Object.keys(FIAT_ADDRESS).map(fiat => FIAT_ADDRESS[fiat])).call(),
      oracle.methods.getPrice(WBNB).call(),
      web3Service.getDefaultBalance(web3Service.defaultAccount.address),
    ]);
    const oraclePrices = data[0].value || [];
    const bnbPrice = wei.from(data[1].value);
    const bnbBalance = wei.from(data[2].value);
    
    const fiats = [];
    const prices = [];
    const allRates = await rates.all();
    let isNeedUpdate = Date.now() - lastUpdate > MAX_PERIOD;
    let message = `🪙 <b>Binance rates update</b>\n`;
    Object.keys(FIAT_ADDRESS).map((fiat, index) => {
      const addr = FIAT_ADDRESS[fiat];
      const price = allRates[fiat.toLowerCase()];
      if (price) {
        const weiPrice = wei.to(price);
        const oracleWei = oraclePrices[index];
        if (weiPrice !== oracleWei) {
          fiats.push(addr);
          prices.push(weiPrice);
          
          if (oracleWei) {
            const oraclePrice = wei.from(oracleWei);
            const diff = (price / oraclePrice - 1) * 100;
            message += `<b>${fiat}:</b> $${oraclePrice.toFixed(6)} > $${price.toFixed(6)} `;
            if (Math.abs(diff) > MAX_DIFF_PERCENT) {
              isNeedUpdate = true;
              message += `(<b>${diff > 0 ? '+' : ''}${diff.toFixed(2)}%</b> ⚠️)\n`;
            } else {
              message += `(${diff > 0 ? '+' : ''}${diff.toFixed(2)}%)\n`;
            }
          } else {
            message += `<b>${fiat}:</b> $${price.toFixed(6)}\n`;
          }
        }
      }
    });

    if (!isNeedUpdate) return;
    const tx = await web3Service.transaction(oracle, 'updatePrices', [
      fiats,
      prices,
    ]);
    lastUpdate = Date.now();
    const gasUsed = Number(wei.from(tx.effectiveGasPrice.toFixed(0)) * tx.gasUsed);
    const gasLeft = bnbBalance - gasUsed;
    message += `<b>Gas used:</b> ${gasUsed.toFixed(4)} BNB ($${(gasUsed * bnbPrice).toFixed(2)})\n`;
    message += `<b>Gas left:</b> ${gasLeft.toFixed(4)} BNB ($${(gasLeft * bnbPrice).toFixed(2)})`;
    telegram.sendToAdmins(message, [
      {title: 'Transaction', url: `https://bscscan.com/tx/${tx.transactionHash}`},
    ]);
  } catch (error) {
    logger.error('[logic/oracle][updatePrices]', error);
    telegram.log(`[logic/oracle][updatePrices] ${error.message}`);
  }
};

setInterval(() => updatePrices(), CHECK_PERIOD);

module.exports = {
  updateCommissions,
  updatePrices,
};