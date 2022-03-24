const _ = require('lodash');
const logger = require('../utils/logger');
//const telegram = require('../services/telegram');
const web3Service = require('../services/web3');
const User = require('../models/user');
const {setUserWallet, getUserWallets} = require('../models/db/web3-wallets');
const pancake = require('../services/pancake');
const coinbase = require('../services/coinbase');
const swapLogic = require('../logic/swap');
const tonService = require('../services/ton');

const FAIL_RUN_TIMEOUT = 10000;

const run = async () => {
    try {
        logger.info('Server started');
        require('../services/stream');

        const balance = await tonService.getDefaultBalance('EQCaFlFd8RL9_nA2X-y7nh3Gpr2y3gSZjPK4ncbMQxN6V60U');
        logger.debug('balance', tonService.fromNano(balance));

        const def = await tonService.createAccount();
        const encryption = tonService.encrypt(def.mnemonic, 0);
        logger.debug('default TON', encryption);

        // Run jobs
        const jobs = require('../services/jobs');
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
