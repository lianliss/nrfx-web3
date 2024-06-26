const _ = require('lodash');
const logger = require('../utils/logger');
const errors = require('../models/error');
const web3Service = require('../services/web3');
const telegram = require('../services/telegram');
const LogsDecoder = require('logs-decoder');
const networks = require('../config/networks');
const appConfig = require('../config');
const p2pLogic = require('../logic/p2p');
const p2pTopics = require('../const/p2pTopics');
const db = require('../models/db');
const wei = require('../utils/wei');

const GET_DATA_INTERVAL = 1000;
const networksList = appConfig.p2pNetworks;
const subscriptions = {};

const sellFactoryABI = require('../const/ABI/p2p/sellFactory');
const buyFactoryABI = require('../const/ABI/p2p/buyFactory');
const sellOfferABI = require('../const/ABI/p2p/sell');
const buyOfferABI = require('../const/ABI/p2p/buy');

const updateOfferSchedule = async (networkID, offerAddress, isBuy = true) => {
  try {
    const service = web3Service[networkID];
    const network = service.network;
    const offerContract = new (web3Service[networkID].web3.eth.Contract)(
      isBuy ? buyOfferABI : sellOfferABI,
      offerAddress,
    );
    
    let schedule = await offerContract.methods.getSchedule().call();
    logger.debug('SCHEDULE', schedule);
    db.setOfferSchedule(offerAddress, schedule);
  } catch (error) {
    logger.error('[updateOfferSchedule]', error);
    telegram.log(`[updateOfferSchedule] ${error.message}`);
  }
};

const updateOffer = async (networkID, offerAddress, isBuy = true) => {
  try {
    const service = web3Service[networkID];
    const network = service.network;
    const offerContract = new (web3Service[networkID].web3.eth.Contract)(
      isBuy ? buyOfferABI : sellOfferABI,
      offerAddress,
    );
    const offer = await offerContract.methods.getOffer().call();
    await db.setOffer({
      offerAddress,
      fiatAddress: offer[1],
      owner: offer[2],
      commission: wei.from(offer[5], 4),
      minTradeAmount: wei.from(offer[7], network.fiatDecimals),
      maxTradeAmount: wei.from(offer[8], network.fiatDecimals),
      isBuy,
      networkID,
    });
  
    updateOfferSchedule(networkID, offerAddress, isBuy);
  } catch (error) {
    logger.error('[updateOffer]', error);
  }
};

const getFiatSymbol = (networkID, fiatAddress) => {
  const service = web3Service[networkID];
  const network = service.network;
  return Object.keys(network.fiats).find(symbol => _.get(network.fiats, symbol) === fiatAddress);
};

const updateTrade = async (networkID, offerAddress, client, isBuy = true, eventName) => {
  try {
    const service = web3Service[networkID];
    const network = service.network;
    const offerContract = new (web3Service[networkID].web3.eth.Contract)(
      isBuy ? buyOfferABI : sellOfferABI,
      offerAddress,
    );
    const data = await Promise.all([
      offerContract.methods.getTrade(client).call(),
      offerContract.methods.getOffer().call(),
    ]);
    const trade = data[0];
    const offer = data[1];
    const symbol = getFiatSymbol(networkID, offer[1]);
    const moneyAmount = wei.from(trade['moneyAmount']);
    const fiatAmount = wei.from(trade['fiatAmount']);
    const side = isBuy ? 'buy' : 'sell';
    await db.setTrade({
      side,
      trader: offer[2],
      offer: offerAddress,
      client: trade['client'],
      chat: trade['chatRoom'],
      lawyer: trade['lawyer'],
      status: Number(trade['status']),
      currency: offer[1],
      moneyAmount,
      fiatAmount,
      timestamp: Number(trade['createDate']),
      networkID,
    });
    if (eventName === 'P2pCancelTrade') {
      await db.setTradeIsCancel({chat: trade['chatRoom']});
    }
    let message;
    switch (eventName) {
      case 'P2pCreateTrade':
        message = `<b>New ${side} trade on network ${networkID}</b>`;
        message += `\n<b>Client:</b> <code>${trade['client']}</code>`;
        message += `\n<b>Money:</b> ${moneyAmount.toFixed(2)} ${symbol}`;
        message += `\n<b>Tokens:</b> ${fiatAmount.toFixed(2)} ${symbol}`;
        break;
      case 'P2pConfirmTrade':
        message = `<b>Trade confirmed on network ${networkID}</b>`;
        message += `\n<b>Client:</b> <code>${trade['client']}</code>`;
        break;
      case 'P2pCancelTrade':
        message = `<b>Trade cancelled on network ${networkID}</b>`;
        message += `\n<b>Client:</b> <code>${trade['client']}</code>`;
        break;
      default:
    }
    if (message) {
      telegram.sendToUser(offer[2], message, {
        links: [
          {title: 'See trade', url: `http://testnet.narfex.com/dapp/p2p/order/${offerAddress}/${trade['client']}`},
        ]
      });
    }
  } catch (error) {
    logger.error('[updateTrade]', error);
    telegram.log(`[updateTrade] Error: ${error.message}`);
  }
};

const updateOfferBanks = async (networkID, offerAddress, isBuy = true) => {
  try {
    const service = web3Service[networkID];
    const network = service.network;
    const offerContract = new (web3Service[networkID].web3.eth.Contract)(
      isBuy ? buyOfferABI : sellOfferABI,
      offerAddress,
    );
    
    const banks = (await offerContract.methods.getBankAccounts().call()).map(a => {
      let parsed;
      try {
        parsed = JSON.parse(a);
      } catch (error) {
        parsed = a;
      }
      return parsed;
    });
    logger.debug('OFFER BANKS', banks);
    let settings = await db.getOfferSettings(offerAddress);
    try {
      settings = JSON.parse(settings);
    } catch (error) {
    }
    settings.banks = banks;
    logger.debug('NEW SETTINGS', settings);
    await db.setOfferSettings(offerAddress, settings);
  } catch (error) {
    logger.error('[updateOfferBanks]', offerAddress, error);
    telegram.log(`[updateOfferBanks] ${error.message}`);
  }
};

const processFactoryLog = async (networkID, log) => {
  try {
    const logsDecoder = LogsDecoder.create();
    logsDecoder.addABI(sellFactoryABI);
    logsDecoder.addABI(buyOfferABI);
    const logs = logsDecoder.decodeLogs([log]);
    logs.map(async log => {
      const eventName = log.name;
      const validator = log.events.find(l => l.name === 'validator').value;
      const fiatAddress = log.events.find(l => l.name === 'fiatAddress').value;
      const offerAddress = log.events.find(l => l.name === 'offer').value;
      const isBuy = log.events.find(l => l.name === 'isBuy').value;
  
      updateOffer(networkID, offerAddress, isBuy);
    });
  } catch (error) {
    logger.error('[processFactoryLog]', error);
  }
};

const processOfferLog = async (networkID, offerLogs) => {
  try {
    const logsDecoder = LogsDecoder.create();
    logsDecoder.addABI(sellOfferABI);
    logsDecoder.addABI(buyFactoryABI);
    const logs = logsDecoder.decodeLogs([offerLogs]);
    const offerAddress = offerLogs.address;
    const isBuy = await db.getOfferIsBuy(offerAddress);
    logs.map(async log => {
      if (!log) {
        logger.debug('UNDEFINED LOGS', offerLogs, log);
        offerLogs.topics.map(topic => {
          if (topic === p2pTopics.offerEvents.P2pOfferAddBankAccount
            || topic === p2pTopics.offerEvents.P2pOfferClearBankAccount) {
            updateOfferBanks(networkID, offerAddress, isBuy);
          }
        });
        return;
      }
      const eventName = log.name;
      telegram.log(`${networkID}\n<b>${eventName}</b>\n${offerAddress}`);
      switch (eventName) {
        case 'P2pOfferEnable':
        case 'P2pOfferDisable':
          db.setOfferActiveness(offerAddress, eventName === 'P2pOfferEnable');
          break;
        case 'P2pOfferKYCRequired':
        case 'P2pOfferKYCUnrequired':
          db.setOfferKYCRequired(offerAddress, eventName === 'P2pOfferKYCRequired');
          break;
        case 'P2pOfferScheduleUpdate':
          updateOfferSchedule(networkID, offerAddress, isBuy);
          break;
        case 'P2pOfferAddBankAccount':
        case 'P2pOfferClearBankAccount':
          updateOfferBanks(networkID, offerAddress, isBuy);
          break;
        case 'P2pCreateTrade':
        case 'P2pSetLawyer':
        case 'P2pConfirmTrade':
        case 'P2pCancelTrade':
          updateTrade(networkID, offerAddress, _.get(log.events.find(e => e.name === '_client'), 'value'), isBuy, eventName);
          break;
        default:
          logger.info('OFFER EVENT', eventName, offerAddress, log.events);
          telegram.log(`<b>${eventName}</b>\n offerAddress`);
          updateOffer(networkID, offerAddress, isBuy);
      }
    });
  } catch (error) {
    logger.error('[processOfferLog]', error);
  }
};

const getData = async networkID => {
  try {
    const service = web3Service[networkID];
    const network = service.network;
    const factoryLogs = await service.web3.eth.getPastLogs({
      address: [
        network.p2p.buyFactory,
        network.p2p.sellFactory,
      ],
      topics: [_.values(p2pTopics.factoryEvents)],
    });
    factoryLogs.map(log => {
      if (!subscriptions[networkID].hashes[log.transactionHash]) {
        subscriptions[networkID].hashes[log.transactionHash] = processFactoryLog(networkID, log);
      }
    });
    const offersLogs = await service.web3.eth.getPastLogs({
      topics: [_.values(p2pTopics.offerEvents)],
    });
    offersLogs.map(log => {
      if (!subscriptions[networkID].hashes[log.transactionHash]) {
        subscriptions[networkID].hashes[log.transactionHash] = processOfferLog(networkID, log);
      }
    });
  } catch (error) {
    logger.error(`[subscription][getData] ${networkID}`, error);
    if (error.message.indexOf('<html>') < 0) {
      telegram.log(`[subscription][getData] ${networkID} ${error.message}`);
    } else {
      telegram.log(`[subscription][getData] ${networkID} HTML received`);
    }
  }
};

const runAllSubscriptions = () => {
  logger.debug('FACTORY', p2pTopics.factoryEvents);
  logger.debug('OFFER', p2pTopics.offerEvents);
  networksList.map(networkID => {
    web3Service[networkID].onInit(() => {
      if (!subscriptions[networkID]) {
        subscriptions[networkID] = {
          hashes: {},
          subscription: null,
          lastBlock: 'latest',
          subErrors: 0,
          lastUpdate: Date.now(),
        };
      }
      if (!subscriptions[networkID].subscription) {
        subscriptions[networkID].subscription = setInterval(() => getData(networkID), GET_DATA_INTERVAL);
      }
    });
  });
};

module.exports = {
  runAllSubscriptions,
  updateOffer,
};
