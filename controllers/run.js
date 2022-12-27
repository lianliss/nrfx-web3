const _ = require('lodash');
const logger = require('../utils/logger');
const telegram = require('../services/telegram');
const web3Service = require('../services/web3');
const User = require('../models/user');
const {setUserWallet, getUserWallets} = require('../models/db/web3-wallets');
const pancake = require('../services/pancake');
const binanceP2P = require('../services/binance-p2p');
const swapLogic = require('../logic/swap');
const tonService = require('../services/ton');
const binance = require('../services/binance');
const db = require('../models/db');
const invoiceLogic = require('../logic/invoice');

const FAIL_RUN_TIMEOUT = 10000;

const run = async () => {
    try {
        logger.info('Server started');
        require('../services/stream');

        telegram.log(`<b>Started</b>`);

        // Run jobs
        const jobs = require('../services/jobs');
    } catch(error) {
        telegram.log('Run error. Waiting...');
        logger.error('Start error', error);

        setTimeout(() => {
            //telegram.log('Running again...');
            run();
        }, FAIL_RUN_TIMEOUT);
    }
};

module.exports = run;
