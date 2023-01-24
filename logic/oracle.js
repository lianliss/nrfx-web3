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

const networksList = ['BSC', 'ETH'];
const networkOracle = {};
['BSC', 'ETH'].map(networkID => {
  networkOracle[networkID] = {
    hashes: {},
    subscription: null,
    lastBlock: 'latest',
    subErrors: 0,
    lastUpdate: Date.now(),
  };
});

networkOracle['BSC'].MAX_PERIOD = 1000 * 60 * 60; // hour
networkOracle['BSC'].CHECK_PERIOD = 1000 * 60 * 10; // 10 minutes
networkOracle['BSC'].PRICE_CHECK_PERIOD = 1000 * 60 * 10; // 10 minutes
networkOracle['BSC'].MAX_DIFF_PERCENT = 0.5;

networkOracle['ETH'].MAX_PERIOD = 1000 * 60 * 60 * 24; // day
networkOracle['ETH'].CHECK_PERIOD = 1000 * 60 * 10; // day
networkOracle['ETH'].PRICE_CHECK_PERIOD = 1000 * 60 * 60 * 24; // day
networkOracle['ETH'].MAX_DIFF_PERCENT = 2;


const updateCommissionsInNetwork = async (dataObject, networkID) => {
  try {
    db.updateCommissions(dataObject);
    const fiatDefault = Number(_.get(dataObject, 'FiatDefault', 0)) / 100;
    const coinDefault = Number(_.get(dataObject, 'BinanceDefault', dataObject.default || 0)) / 100;
    const defaultRef = 0.6 / 100;
    
    // Parse new commissions
    const fiatComm = {};
    const network = web3Service[networkID].network;
    const contracts = network.contracts;
    Object.keys(network.fiats).map(fiat => {
      const comm = Number(_.get(dataObject, fiat.toLowerCase(), fiatDefault));
      const addr = network.fiats[fiat];
      if (comm !== fiatDefault) {
        fiatComm[addr.toLowerCase()] = comm / 100;
      }
    });
  
    // Oracle contract
    const oracle = new (web3Service[networkID].web3.eth.Contract)(
      oracleABI,
      contracts.oracle,
    );
    
    // Get oracle data
    const oracleData = await Promise.all([
      oracle.methods.getSettings().call(),
      oracle.methods.getAllTokens().call(),
      oracle.methods.getPrice(contracts.wrap).call(),
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
    const tx = await web3Service[networkID].transaction(oracle, 'updateAllCommissions', [
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
<b>Gas used:</b> ${gasUsed.toFixed(4)} ${network.defaultToken.toUpperCase()} ($${(gasUsed * bnbPrice).toFixed(2)})`, [
      {title: 'Transaction', url: `${network.scan}/tx/${tx.transactionHash}`},
    ]);
  } catch (error) {
    logger.error('[logic/oracle][updateCommissionsInNetwork]', networkID, error);
    telegram.log(`[logic/oracle][updateCommissionsInNetwork][${networkID}] ${error.message}`);
  }
  return;
};
const updateCommissions = async dataObject => {
  try {
    Promise.all(networksList.map(networkID => updateCommissionsInNetwork(dataObject, networkID)));
  } catch (error) {
    logger.error('[logic/oracle][updateCommissions]', error);
  }
  return;
};

const updatePricesInNetwork = async networkID => {
  try {
    logger.debug('[updatePricesInNetwork]', networkID);
    const network = web3Service[networkID].network;
    const contracts = network.contracts;
    const oracleSettings = networkOracle[networkID];
    const oracle = new (web3Service[networkID].web3.eth.Contract)(
      oracleABI,
      contracts.oracle,
    );
    const data = await Promise.allSettled([
      oracle.methods.getPrices(Object.keys(network.fiats).map(fiat => network.fiats[fiat])).call(),
      oracle.methods.getPrice(contracts.wrap).call(),
      web3Service[networkID].getDefaultBalance(web3Service[networkID].defaultAccount.address),
    ]);
    const oraclePrices = data[0].value || [];
    const bnbPrice = wei.from(data[1].value);
    const bnbBalance = wei.from(data[2].value);
    
    const fiats = [];
    const prices = [];
    const allRates = await rates.all();
    let isNeedUpdate = Date.now() - oracleSettings.lastUpdate > oracleSettings.MAX_PERIOD;
    let message = `🪙 <b>Binance rates update</b>\n`;
    Object.keys(network.fiats).map((fiat, index) => {
      const addr = network.fiats[fiat];
      const price = allRates[fiat.toLowerCase()];
      if (price) {
        const weiPrice = wei.to(price, network.fiatDecimals);
        const oracleWei = oraclePrices[index];
        if (weiPrice !== oracleWei) {
          fiats.push(addr);
          prices.push(weiPrice);
          
          if (oracleWei) {
            const oraclePrice = wei.from(oracleWei);
            const diff = (price / oraclePrice - 1) * 100;
            message += `<b>${fiat}:</b> $${oraclePrice.toFixed(6)} > $${price.toFixed(6)} `;
            if (Math.abs(diff) > oracleSettings.MAX_DIFF_PERCENT) {
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
  
    logger.debug('[updatePricesInNetwork]', networkID, oraclePrices, isNeedUpdate, fiats, prices, allRates);
    if (!isNeedUpdate) return;
    const tx = await web3Service[networkID].transaction(oracle, 'updatePrices', [
      fiats,
      prices,
    ]);
    oracleSettings.lastUpdate = Date.now();
    const gasUsed = Number(wei.from(tx.effectiveGasPrice.toFixed(0)) * tx.gasUsed);
    const gasLeft = bnbBalance - gasUsed;
    message += `<b>Gas used:</b> ${gasUsed.toFixed(4)} ${network.defaultToken.toUpperCase()} ($${(gasUsed * bnbPrice).toFixed(2)})\n`;
    message += `<b>Gas left:</b> ${gasLeft.toFixed(4)} ${network.defaultToken.toUpperCase()} ($${(gasLeft * bnbPrice).toFixed(2)})`;
    if (networkID === 'ETH') {
      telegram.sendToAdmins(message, [
        {title: 'Transaction', url: `${network.scan}/tx/${tx.transactionHash}`},
      ]);
    }
  } catch (error) {
    logger.error('[logic/oracle][updatePricesInNetwork]', networkID, error);
    telegram.log(`[logic/oracle][updatePricesInNetwork][${networkID}] ${error.message}`);
  }
};
const updatePrices = async () => {
  try {
    Promise.all(networksList.map(networkID => updatePricesInNetwork(networkID)));
  } catch (error) {
    logger.error('[logic/oracle][updatePrices]', error);
  }
};

if (!isLocal) {
  networksList.map(networkID => {
    web3Service[networkID].onInit(() => {
      const oracleSettings = networkOracle[networkID];
      setTimeout(() => updatePricesInNetwork(networkID), 1000 * 10);
      setInterval(() => updatePricesInNetwork(networkID), oracleSettings.PRICE_CHECK_PERIOD);
    });
  });
}

const processExchangerTransaction = async (txHash, networkID) => {
  try {
    telegram.log(`[processExchangerTransaction][${networkID}]\n<code>${txHash}</code>`);
    const logsDecoder = LogsDecoder.create();
    logsDecoder.addABI(exchangeRouterABI);
    
    const stored = await db.getExchangeHistoryByHash(txHash);
    if (stored.length) return;
    
    let receipt = await web3Service[networkID].web3.eth.getTransactionReceipt(txHash);
    let attemptCounter = 0;
    while (!receipt && attemptCounter < 100) {
      receipt = await web3Service[networkID].web3.eth.getTransactionReceipt(txHash);
      attemptCounter++;
    }
    if (!receipt) throw Error("Can't read receipt");
    const decodedLogs = logsDecoder.decodeLogs(receipt.logs);
    if (decodedLogs) {
      let swapDEX;
      let swapFiat;
      let account;
  
      const pool = new (web3Service[networkID].web3.eth.Contract)(
        poolABI,
        web3Service[networkID].network.contracts.exchangeRouter,
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
      const promises = tokens.map(address => (new (web3Service[networkID].web3.eth.Contract)(
        bep20ABI,
        address,
      )).methods.symbol().call());
      (await Promise.all(promises)).map((symbol, index) => {
        symbols[tokens[index].toLowerCase()] = symbol;
      });
      
      let message = `<b>🔄 Exchange:</b>\n`
        + `<b>Account: </b><code>${account}</code>\n`;
      if (swapFiat && swapDEX) {
        const isIncreasePool = swapFiat.from.toLowerCase() === web3Service[networkID].network.contracts.exchangeRouter.usdc.toLowerCase();
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
            networkID,
          });
          message += `<b>From:</b> ${swapFiat.inAmount.toFixed(5)} ${symbols[swapFiat.from]}\n`
            + `<b>To:</b> ${swapDEX.outAmount.toFixed(5)} ${symbols[swapDEX.to]}\n`;
          if (isIncreasePool) {
            message += `<b>Pool increase:</b> +${swapFiat.inAmount.toFixed(2)} USDC (Balance: <b>${balance.toFixed(2)}</b> USDC)\n`;
          } else {
            message += `<b>Pool decrease:</b> -${swapFiat.outAmount.toFixed(2)} USDC (Balance: <b>${balance.toFixed(2)}</b> USDC)\n`;
          }
          message += `<b>Commission:</b> ${swapFiat.commissionAmount.toFixed(5)} ${symbols[swapFiat.commissionToken]} (${swapFiat.commission.toFixed(2)}%)\n`;
          if (swapFiat.referReward) {
            const referId = await referLogic.getAccountRefer(account);
            if (referId) db.addReferReward(referId, account, symbols[swapFiat.commissionToken], swapFiat.referReward);
            message += `<b>Refer reward:</b> ${swapFiat.referReward.toFixed(5)} ${symbols[swapFiat.commissionToken]}\n`;
          }
          message += `<b>Profit:</b> ${swapFiat.profitUSDT.toFixed(5)} USDC\n`;
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
            networkID,
          });
          message += `<b>From:</b> ${swapDEX.inAmount.toFixed(5)} ${symbols[swapDEX.from]}\n`
            + `<b>To:</b> ${swapFiat.outAmount.toFixed(5)} ${symbols[swapFiat.to]}\n`;
          if (isIncreasePool) {
            message += `<b>Pool increase:</b> +${swapFiat.inAmount.toFixed(2)} USDC (Balance: <b>${balance.toFixed(2)} USDC</b>)\n`;
          } else {
            message += `<b>Pool decrease:</b> -${swapFiat.outAmount.toFixed(2)} USDC (Balance: <b>${balance.toFixed(2)} USDC</b>)\n`;
          }
          message += `<b>Commission:</b> ${swapFiat.commissionAmount.toFixed(5)} ${symbols[swapFiat.commissionToken]} (${swapFiat.commission.toFixed(2)}%)\n`;
          if (swapFiat.referReward) {
            const referId = await referLogic.getAccountRefer(account);
            if (referId) db.addReferReward(referId, account, symbols[swapFiat.commissionToken], swapFiat.referReward);
            message += `<b>Refer reward:</b> ${swapFiat.referReward.toFixed(5)} ${symbols[swapFiat.commissionToken]}\n`;
          }
          message += `<b>Profit:</b> ${swapFiat.profitUSDT.toFixed(5)} USDC\n`;
        }
      } else {
        if (swapFiat) {
          const isIncreasePool = swapFiat.from.toLowerCase() === web3Service[networkID].network.contracts.usdc.toLowerCase();
          const isWithUSDT = isIncreasePool || swapFiat.to.toLowerCase() === web3Service[networkID].network.contracts.usdc.toLowerCase();
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
            networkID,
          });
          message += `<b>From:</b> ${swapFiat.inAmount.toFixed(5)} ${symbols[swapFiat.from]}\n`
            + `<b>To:</b> ${swapFiat.outAmount.toFixed(5)} ${symbols[swapFiat.to]}\n`;
          if (isWithUSDT) {
            if (isIncreasePool) {
              message += `<b>Pool increase:</b> +${swapFiat.inAmount.toFixed(2)} USDC (Balance: <b>${balance.toFixed(2)}</b> USDC)\n`;
            } else {
              message += `<b>Pool decrease:</b> -${swapFiat.outAmount.toFixed(2)} USDC (Balance: <b>${balance.toFixed(2)}</b> USDC)\n`;
            }
          }
          message += `<b>Commission:</b> ${swapFiat.commissionAmount.toFixed(5)} ${symbols[swapFiat.commissionToken]} (${swapFiat.commission.toFixed(2)}%)\n`;
          if (swapFiat.referReward) {
            const referId = await referLogic.getAccountRefer(account);
            if (referId) db.addReferReward(referId, account, symbols[swapFiat.commissionToken], swapFiat.referReward);
            message += `<b>Refer reward:</b> ${swapFiat.referReward.toFixed(5)} ${symbols[swapFiat.commissionToken]}\n`;
          }
          message += `<b>Profit:</b> ${swapFiat.profitUSDT.toFixed(5)} USDC\n`;
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
            networkID,
          });
          message += `<b>From:</b> ${swapDEX.inAmount.toFixed(5)} ${symbols[swapDEX.from]}\n`
            + `<b>To:</b> ${swapDEX.outAmount.toFixed(5)} ${symbols[swapDEX.to]}\n`;
        }
      }
      telegram.sendToAdmins(message, {
        links: [{title: 'Transaction', url: `${web3Service[networkID].network.scan}/tx/${txHash}`}]
      });
    }
  } catch (error) {
    logger.error('[processExchangerTransaction]', txHash, error);
    telegram.log(`[processExchangerTransaction]\n<code>${txHash}</code>\n${error.message}`);
  }
};

const subscriptionCallbacks = {};
networksList.map(networkID => {
  subscriptionCallbacks[networkID] = subscriptionCallback = (error, log) => {
    if (error) {
      logger.warn(`[oracle][${networkID}] Exchanger subscription error`, error);
      telegram.log(`[${networkID}] Exchanger subscription error: ${error.message}`);
    
      if (error.message.indexOf('connection not open on send') >= 0) {
        const Web3 = require('web3');
        const config = require('../config');
        const service = web3Service[networkID];
        service.wss = new Web3(service.network.providerWss);
        if (networkOracle[networkID].subErrors < 3) {
          networkOracle[networkID].subErrors++;
          startExchangerListening();
        } else {
          networkOracle[networkID].subErrors = 0;
          telegram.log(`[subscriptionCallback][${networkID}] Too much subErrors`);
        }
      }
    } else {
      const {transactionHash} = log;
      if (!networkOracle[networkID].hashes[transactionHash]) {
        networkOracle[networkID].hashes[transactionHash] = processExchangerTransaction(transactionHash, networkID);
      }
    }
  };
});

const startExchangerListening = networkID => {
  const network = web3Service[networkID].network;
  if (networkOracle[networkID].subscription) {
    networkOracle[networkID].subscription.unsubscribe();
  }
  
  networkOracle[networkID].subscription = web3Service[networkID].wss.eth.subscribe('logs', {
    address: web3Service[networkID].network.contracts.exchangeRouter,
    topics: null,
  }, subscriptionCallbacks[networkID]);
  
  (async () => {
    // Update last transactions
    try {
      const Web3 = require('web3');
      const web3 = new Web3(network.providerAddress);
      const events = await web3.eth.getPastLogs({
        fromBlock: networkOracle[networkID].lastBlock,
        address: web3Service[networkID].network.contracts.exchangeRouter,
      });
      events.map(event => {
        const {transactionHash} = event;
        if (!networkOracle[networkID].hashes[transactionHash]) {
          networkOracle[networkID].hashes[transactionHash] = processExchangerTransaction(transactionHash, networkID);
        }
      });
    } catch (error) {
      logger.error('[getPastLogs]', networkID, error);
    }
    // Update last block number
    try {
      const block = await web3Service[networkID].web3.eth.getBlock('latest');
      networkOracle[networkID].lastBlock = block.number;
    } catch (error) {
      logger.error('[getBlock]', error);
    }
  })();
};
networksList.map(networkID => {
  web3Service[networkID].onInit(() => {
    startExchangerListening(networkID);
    const oracleSettings = networkOracle[networkID];
    setInterval(() => startExchangerListening(networkID), oracleSettings.CHECK_PERIOD);
  });
});

module.exports = {
  updateCommissions,
  updatePrices,
};