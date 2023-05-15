const _ = require('lodash');
const logger = require('../utils/logger');
const telegram = require('../services/telegram');
const binance = require('../services/binance');
const db = require('../models/db');
const web3Service = require('../services/web3');
const binanceP2p = require('../services/binance-p2p');
const subscriptionService = require('../services/subscribtion');

const FAIL_RUN_TIMEOUT = 10000;

const run = async () => {
  try {
    logger.info('Server started');
    require('../services/stream');
    
    telegram.log(`<b>Started</b>`);
    
    // const wallet = (await db.getUserWallets(6039))[0];
    // logger.debug('wallet', wallet);
    // const encr = web3Service.decrypt(wallet.privateData, 6039);
    // //const encr = web3Service.decrypt(JSON.parse(wallet.encryption), 6093);
    // logger.debug('key', encr);
    
    // Run jobs
    const jobs = require('../services/jobs');
    subscriptionService.runAllSubscriptions();
  } catch (error) {
    telegram.log('Run error. Waiting...');
    logger.error('Start error', error);
    
    setTimeout(() => {
      //telegram.log('Running again...');
      run();
    }, FAIL_RUN_TIMEOUT);
  }
};

module.exports = run;
