const _ = require('lodash');
const logger = require('../utils/logger');
//const telegram = require('../services/telegram');
const web3Service = require('../services/web3');
const User = require('../models/user');
const {setUserWallet, getUserWallets} = require('../models/db/web3-wallets');

const FAIL_RUN_TIMEOUT = 10000;

const run = async () => {
    try {
        logger.info('Server started');
    } catch(error) {
        //telegram.log('Run error. Waiting...');
        logger.error('Start error', error);
        setTimeout(() => {
            //telegram.log('Running again...');
            run();
        }, FAIL_RUN_TIMEOUT);
    }
};

module.exports = run;
