const _ = require('lodash');
const logger = require('../utils/logger');
const errors = require('../models/error');
const web3Service = require('../services/web3');
const telegram = require('../services/telegram');
const LogsDecoder = require('logs-decoder');
const networks = require('../config/networks');
const p2pLogic = require('../logic/p2p');
const p2pTopics = require('../const/p2pTopics');

const networksList = ['BSCTest'];
const subscriptions = {};
networksList.map(networkID => {
  subscriptions[networkID] = {
    hashes: {},
    subscription: null,
    lastBlock: 'latest',
    subErrors: 0,
    lastUpdate: Date.now(),
  };
});

const isP2pAvailable = networkID => !!networks[networkID].p2p;
const encode = event => web3Service.web3.eth.abi.encodeEventSignature(event);

const subscriptionCallbacks = {};
networksList.map(networkID => {
  subscriptionCallbacks[networkID] = (error, log) => {
    if (error) {
      logger.warn(`[subscription][${networkID}] Subscription error`, error);
      telegram.log(`[${networkID}] Subscription error: ${error.message}`);
      
      if (error.message.indexOf('connection not open on send') >= 0) {
        const Web3 = require('web3');
        const config = require('../config');
        const service = web3Service[networkID];
        service.wss = new Web3(service.network.providerWss);
        if (subscriptions[networkID].subErrors < 3) {
          subscriptions[networkID].subErrors++;
          runSubscription(networkID);
        } else {
          subscriptions[networkID].subErrors = 0;
          telegram.log(`[subscriptionCallback][${networkID}] Too much subErrors`);
        }
      }
    } else {
      const {transactionHash} = log;
      logger.info('NEW LOG', log);
      return;
      // if (!networkOracle[networkID].hashes[transactionHash]) {
      //   networkOracle[networkID].hashes[transactionHash] = processExchangerTransaction(transactionHash, networkID);
      // }
    }
  };
});

const runSubscription = async (networkID = 'BSCTest') => {
  const network = web3Service[networkID].network;
  if (subscriptions[networkID].subscription) {
    subscriptions[networkID].subscription.unsubscribe();
  }
  
  // subscriptions[networkID].subscription = web3Service[networkID].wss.eth.getPastLogs({
  //   fromBlock: 'latest',
  //   address: '0xcDA8eD22bB27Fe84615f368D09B5A8Afe4a99320',
  //   topics: null,
  // }, subscriptionCallbacks[networkID]);
  
  try {
    const receipt = await web3Service[networkID].web3.eth.getTransaction('0x284b8eff40685724adec73de04d320c4a9d891e19d664adf18e954d358a3e1d7');
    logger.debug('receipt', receipt);
    // logger.debug('topics', receipt.logs[0].topics);
    // const logsDecoder = LogsDecoder.create();
    // logsDecoder.addABI(exchangeRouterABI);
    // const decodedLogs = logsDecoder.decodeLogs(receipt.logs);
  } catch (error) {
    logger.error('[runSubscription]', error);
  }
};

const runAllSubscriptions = () => {
  networksList.map(networkID => {
    runSubscription(networkID);
  });
};

module.exports = {
  runAllSubscriptions,
};
