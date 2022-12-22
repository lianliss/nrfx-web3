const _ = require('lodash');
const logger = require('../utils/logger');
const errors = require('../models/error');
const web3Service = require('../services/web3');
const db = require('../models/db');
const {FIAT_ADDRESS, ORACLE_CONTRACT, EXCHANGE_ROUTER, EXCHANGE_POOL, USDT_ADDRESS} = require('../const');
const oracleABI = require('../const/ABI/oracle');
const exchangeRouterABI = require('../const/ABI/exchangeRouter');
const bep20ABI = require('../const/ABI/bep20Token');
const poolABI = require('../const/ABI/exchangerPool');
const wei = require('../utils/wei');
const {rates} = require('../models/cache');
const telegram = require('../services/telegram');
const isLocal = process.env.NODE_ENV === 'local';
const LogsDecoder = require('logs-decoder');
const referLogic = require('../logic/refers');

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
let lastUpdate = Date.now();
const MAX_PERIOD = 1000 * 60 * 60; // hour
const CHECK_PERIOD = 1000 * 60 * 10; // 10 minutes
const MAX_DIFF_PERCENT = 0.5;
const hashes = {};
let subscription;

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

if (!isLocal) {
  setInterval(() => updatePrices(), CHECK_PERIOD);
}

const processExchangerTransaction = async txHash => {
  try {
    const logsDecoder = LogsDecoder.create();
    logsDecoder.addABI(exchangeRouterABI);
    
    let receipt = await web3Service.web3.eth.getTransactionReceipt(txHash);
    let attemptCounter = 0;
    while (!receipt && attemptCounter < 100) {
      receipt = await web3Service.web3.eth.getTransactionReceipt(txHash);
      attemptCounter++;
    }
    if (!receipt) throw Error("Can't read receipt");
    const decodedLogs = logsDecoder.decodeLogs(receipt.logs);
    if (decodedLogs) {
      let swapDEX;
      let swapFiat;
      let account;
  
      const pool = new (web3Service.web3.eth.Contract)(
        poolABI,
        EXCHANGE_POOL,
      );
      const balance = wei.from(await pool.methods.getBalance().call());
      
      decodedLogs.filter(l => !!l).map(log => {
        const {name, events} = log;
        if (name === 'SwapDEX') {
          account = events.find(e => e.name === '_account').value;
          swapDEX = {
            from: events.find(e => e.name === '_fromToken').value.toLowerCase(),
            to: events.find(e => e.name === '_toToken').value.toLowerCase(),
            inAmount: wei.from(events.find(e => e.name === 'inAmount').value),
            outAmount: wei.from(events.find(e => e.name === 'outAmount').value),
          };
        }
        if (name === 'SwapFiat') {
          account = events.find(e => e.name === '_account').value;
          const exchange = events.find(e => e.name === '_exchange').value;
          swapFiat = {
            from: events.find(e => e.name === '_fromToken').value.toLowerCase(),
            to: events.find(e => e.name === '_toToken').value.toLowerCase(),
            rate: wei.from(exchange[0]),
            commission: wei.from(exchange[1], 4) * 100,
            inAmount: wei.from(exchange[4]),
            outAmount: wei.from(exchange[5]),
            commissionToken: exchange[6].toLowerCase(),
            commissionAmount: wei.from(exchange[7]),
            referReward: wei.from(exchange[8]),
            profitUSDT: wei.from(exchange[9]),
          };
        }
      });
      if (!swapDEX && !swapFiat) return;
      
      // Get tokens list
      let tokens = [];
      if (swapDEX) {
        tokens.push(swapDEX.from);
        tokens.push(swapDEX.to);
      }
      if (swapFiat) {
        tokens.push(swapFiat.from);
        tokens.push(swapFiat.to);
      }
      tokens = _.uniq(tokens);
      
      // Get symbols
      const symbols = {};
      const promises = tokens.map(address => (new (web3Service.web3.eth.Contract)(
        bep20ABI,
        address,
      )).methods.symbol().call());
      (await Promise.all(promises)).map((symbol, index) => {
        symbols[tokens[index].toLowerCase()] = symbol;
      });
      
      let message = `<b>🔄 Exchange:</b>\n`
        + `<b>Account: </b><code>${account}</code>\n`;
      if (swapFiat && swapDEX) {
        const isIncreasePool = swapFiat.from.toLowerCase() === USDT_ADDRESS.toLowerCase();
        if (swapFiat.to === swapDEX.from) {
          // If fiat swap first
          db.addExchangeHistory({
            type: 'exchange',
            accountAddress: account,
            sourceCurrency: symbols[swapFiat.from],
            targetCurrency: symbols[swapDEX.to],
            commissionCurrency: symbols[swapFiat.commissionToken],
            sourceAmount: swapFiat.inAmount,
            targetAmount: swapDEX.outAmount,
            commission: swapFiat.commissionAmount,
            referReward: swapFiat.referReward,
            txHash,
            isCompleted: true,
          });
          message += `<b>From:</b> ${swapFiat.inAmount.toFixed(5)} ${symbols[swapFiat.from]}\n`
            + `<b>To:</b> ${swapDEX.outAmount.toFixed(5)} ${symbols[swapDEX.to]}\n`;
          if (isIncreasePool) {
            message += `<b>Pool increase:</b> +${swapFiat.inAmount.toFixed(2)} USDT (Balance: <b>${balance.toFixed(2)}</b> USDT)\n`;
          } else {
            message += `<b>Pool decrease:</b> -${swapFiat.outAmount.toFixed(2)} USDT (Balance: <b>${balance.toFixed(2)}</b> USDT)\n`;
          }
          message += `<b>Commission:</b> ${swapFiat.commissionAmount.toFixed(5)} ${symbols[swapFiat.commissionToken]} (${swapFiat.commission.toFixed(2)}%)\n`;
          if (swapFiat.referReward) {
            const referId = await referLogic.getAccountRefer(account);
            if (referId) db.addReferReward(referId, account, symbols[swapFiat.commissionToken], swapFiat.referReward);
            message += `<b>Refer reward:</b> ${swapFiat.referReward.toFixed(5)} ${symbols[swapFiat.commissionToken]}\n`;
          }
          message += `<b>Profit:</b> ${swapFiat.profitUSDT.toFixed(5)} USDT\n`;
        } else {
          db.addExchangeHistory({
            type: 'exchange',
            accountAddress: account,
            sourceCurrency: symbols[swapDEX.from],
            targetCurrency: symbols[swapFiat.to],
            commissionCurrency: symbols[swapFiat.commissionToken],
            sourceAmount: swapDEX.inAmount,
            targetAmount: swapFiat.outAmount,
            commission: swapFiat.commissionAmount,
            referReward: swapFiat.referReward,
            txHash,
            isCompleted: true,
          });
          message += `<b>From:</b> ${swapDEX.inAmount.toFixed(5)} ${symbols[swapDEX.from]}\n`
            + `<b>To:</b> ${swapFiat.outAmount.toFixed(5)} ${symbols[swapFiat.to]}\n`;
          if (isIncreasePool) {
            message += `<b>Pool increase:</b> +${swapFiat.inAmount.toFixed(2)} USDT (Balance: <b>${balance.toFixed(2)} USDT</b>)\n`;
          } else {
            message += `<b>Pool decrease:</b> -${swapFiat.outAmount.toFixed(2)} USDT (Balance: <b>${balance.toFixed(2)} USDT</b>)\n`;
          }
          message += `<b>Commission:</b> ${swapFiat.commissionAmount.toFixed(5)} ${symbols[swapFiat.commissionToken]} (${swapFiat.commission.toFixed(2)}%)\n`;
          if (swapFiat.referReward) {
            const referId = await referLogic.getAccountRefer(account);
            if (referId) db.addReferReward(referId, account, symbols[swapFiat.commissionToken], swapFiat.referReward);
            message += `<b>Refer reward:</b> ${swapFiat.referReward.toFixed(5)} ${symbols[swapFiat.commissionToken]}\n`;
          }
          message += `<b>Profit:</b> ${swapFiat.profitUSDT.toFixed(5)} USDT\n`;
        }
      } else {
        if (swapFiat) {
          const isIncreasePool = swapFiat.from.toLowerCase() === USDT_ADDRESS.toLowerCase();
          const isWithUSDT = isIncreasePool || swapFiat.to.toLowerCase() === USDT_ADDRESS.toLowerCase();
          db.addExchangeHistory({
            type: 'exchange',
            accountAddress: account,
            sourceCurrency: symbols[swapFiat.from],
            targetCurrency: symbols[swapFiat.to],
            commissionCurrency: symbols[swapFiat.commissionToken],
            sourceAmount: swapFiat.inAmount,
            targetAmount: swapFiat.outAmount,
            commission: swapFiat.commissionAmount,
            referReward: swapFiat.referReward,
            txHash,
            isCompleted: true,
          });
          message += `<b>From:</b> ${swapFiat.inAmount.toFixed(5)} ${symbols[swapFiat.from]}\n`
            + `<b>To:</b> ${swapFiat.outAmount.toFixed(5)} ${symbols[swapFiat.to]}\n`;
          if (isWithUSDT) {
            if (isIncreasePool) {
              message += `<b>Pool increase:</b> +${swapFiat.inAmount.toFixed(2)} USDT (Balance: <b>${balance.toFixed(2)}</b> USDT)\n`;
            } else {
              message += `<b>Pool decrease:</b> -${swapFiat.outAmount.toFixed(2)} USDT (Balance: <b>${balance.toFixed(2)}</b> USDT)\n`;
            }
          }
          message += `<b>Commission:</b> ${swapFiat.commissionAmount.toFixed(5)} ${symbols[swapFiat.commissionToken]} (${swapFiat.commission.toFixed(2)}%)\n`;
          if (swapFiat.referReward) {
            const referId = await referLogic.getAccountRefer(account);
            if (referId) db.addReferReward(referId, account, symbols[swapFiat.commissionToken], swapFiat.referReward);
            message += `<b>Refer reward:</b> ${swapFiat.referReward.toFixed(5)} ${symbols[swapFiat.commissionToken]}\n`;
          }
          message += `<b>Profit:</b> ${swapFiat.profitUSDT.toFixed(5)} USDT\n`;
        } else {
          db.addExchangeHistory({
            type: 'exchange',
            accountAddress: account,
            sourceCurrency: symbols[swapDEX.from],
            targetCurrency: symbols[swapDEX.to],
            commissionCurrency: symbols[swapDEX.from],
            sourceAmount: swapDEX.inAmount,
            targetAmount: swapDEX.outAmount,
            commission: 0,
            referReward: 0,
            txHash,
            isCompleted: true,
          });
          message += `<b>From:</b> ${swapDEX.inAmount.toFixed(5)} ${symbols[swapDEX.from]}\n`
            + `<b>To:</b> ${swapDEX.outAmount.toFixed(5)} ${symbols[swapDEX.to]}\n`;
        }
      }
      telegram.sendToAdmins(message, {
        links: [{title: 'Transaction', url: `https://bscscan.com/tx/${txHash}`}]
      });
    }
  } catch (error) {
    logger.error('[processExchangerTransaction]', txHash, error);
    telegram.log(`[processExchangerTransaction]\n<code>${txHash}</code>\n${error.message}`);
  }
};

const startExchangerListening = () => {
  if (subscription) {
    web3Service.wss.eth.clearSubscriptions();
  }
  
  subscription = web3Service.wss.eth.subscribe('logs', {
    address: EXCHANGE_ROUTER,
    topics: null,
  }, (error, log) => {
    if (error) {
      logger.warn('[oracle] Exchanger subscription error', error);
      telegram.log(`Exchanger subscription error: ${error.message}`);
    } else {
      const {transactionHash} = log;
      if (!hashes[transactionHash]) {
        hashes[transactionHash] = processExchangerTransaction(transactionHash);
      }
    }
  });
};
startExchangerListening();
setInterval(() => startExchangerListening(), CHECK_PERIOD);

module.exports = {
  updateCommissions,
  updatePrices,
};