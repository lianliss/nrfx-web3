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

        // const db = require('../services/mysql');
        // const wallets = {
        //     '0x17c000fcbfe5cf32889b299fff076f271e800e61': {
        //         version: 3,
        //         id: '71e3cabd-4102-49b7-851f-e5e7bc7c271c',
        //         address: '17c000fcbfe5cf32889b299fff076f271e800e61',
        //         crypto: {
        //             ciphertext: '777671eb36ab6c02ac6e430211b367c3e8ec87303c52877f2ae2a31469f8969f',
        //             cipherparams: { iv: 'e65af604cf08151f2488de261a15ca71' },
        //             cipher: 'aes-128-ctr',
        //             kdf: 'scrypt',
        //             kdfparams: {
        //                 dklen: 32,
        //                 salt: 'e8e057149d0e6823e2066ba4915b1b89504a8ac1b1b59d608a0bd114c30b1a61',
        //                 n: 8192,
        //                 r: 8,
        //                 p: 1
        //             },
        //             mac: '8182c375e1e7f8006aaf4dfd4f7e6dc2c766384200b510b0c820ec58bdc94996'
        //         }
        //     },
        // };
        //
        // Object.keys(wallets).map(address => {
        //     const encryption = JSON.stringify(wallets[address]);
        //     const record = db.query(`
        //         SELECT *
        //         FROM web3_wallets
        //         WHERE address = '${address}';
        //     `).then(data => {
        //         logger.debug('Found wallets', address, data);
        //         data.map(row => {
        //             setUserWallet({
        //                 userID: row.user_id,
        //                 address,
        //                 encryption,
        //             });
        //         })
        //     }).catch(error => {
        //         logger.debug(`Can't load ${address} data`);
        //     });
        // });
	

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
