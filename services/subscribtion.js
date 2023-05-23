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
    
    let schedule = await offerContract.methods.getSchedule().call();
    logger.info("SCHEDULE", schedule);
    schedule = schedule.map(week => week.map(day => Number(day)).join(''));
    const settings = await db.getOfferSettings(offerAddress);
    settings.schedule = schedule;
    db.setOfferSettings(offerAddress, settings);
    logger.info('settings', settings);
  } catch (error) {
    logger.error('[updateOffer]', error);
  }
};

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
    const settings = await db.getOfferSettings(offerAddress);
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
    const isBuy = db.getOfferIsBuy(offerAddress);
    logs.map(async log => {
      if (!log) {
        logger.debug('UNDEFINED LOGS', offerLogs, log);
        offerLogs.topics.map(topic => {
          if (topic === p2pTopics.offerEvents.P2pOfferAddBankAccount) {
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
        default:
          logger.info('OFFER EVENT', eventName, offerAddress, log.events);
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
