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
        const balance = await web3Service.getBalances('0x08AbC7831db337419579EC1CD36460B47A1Df492');
        Object.keys(balance).map(token => {
            logger.info(token, web3Service.web3.utils.fromWei(balance[token], 'ether'));
        })
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
