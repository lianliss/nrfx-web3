const _ = require('lodash');
const logger = require('../utils/logger');
//const telegram = require('../services/telegram');
const web3Service = require('../services/web3');
const User = require('../models/user');
const {setUserWallet, getUserWallets} = require('../models/db/web3-wallets');
const pancake = require('../services/pancake');
const coinbase = require('../services/coinbase');
const swapLogic = require('../logic/swap');

const FAIL_RUN_TIMEOUT = 10000;

const run = async () => {
    try {
        logger.info('Server started');

        // const user = await User.getByID(4279);
        // swapLogic.swapFiatToToken({
        //     user,
        //     fiat: 'rub',
        //     token: 'nrfx',
        //     fiatAmount: 200,
        // });
    } catch(error) {
        //telegram.log('Run error. Waiting...');
        logger.error('Start error', error);
        return;
        setTimeout(() => {
            //telegram.log('Running again...');
            run();
        }, FAIL_RUN_TIMEOUT);
    }
};

module.exports = run;
