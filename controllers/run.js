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
    
    // const account = await web3Service.createAccount();
    // logger.info('ACCOUNT', account);
    // const encryption = web3Service.encrypt('0xd5eb7a915c6459e2860da11c7fcc675077f9a3d0176acc5359b48ffa657bf415', 0);
    // logger.debug('ENCR', encryption, JSON.stringify(encryption));
    
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
