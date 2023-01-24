const _ = require('lodash');
const logger = require('../utils/logger');
const telegram = require('../services/telegram');
const binance = require('../services/binance');
const db = require('../models/db');
const web3Service = require('../services/web3');
const binanceP2p = require('../services/binance-p2p');

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
