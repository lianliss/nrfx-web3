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

const FAIL_RUN_TIMEOUT = 10000;

const run = async () => {
    try {
        logger.info('Server started');
        require('../services/stream');

        telegram.log('Started');

        // try {
        //   const data = await Promise.all([
        //     User.getByTelegramID(162131210),
        //     db.getReservationById(1325),
        //   ]);
        //   await telegram.sendCardOperation(data[0], data[1][0]);
        // } catch (error) {
        //   logger.error('RUN test', error);
        // }

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
