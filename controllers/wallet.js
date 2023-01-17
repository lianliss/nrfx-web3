const _ = require('lodash');
const logger = require('../utils/logger');
const getPasswordHash = require('../models/password-hash');
const {getService} = require('../services/networks');

const getWallets = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const wallets = user.wallets.map(w => ({
                address: w.data.address,
                network: w.data.network,
                isGenerated: !!w.data.isGenerated,
            }));

            user.wallets.map(w => {
                logger.info('data', w.data, w.getPrivateKey());
            });

            res.status(200).json(wallets);
        } catch (error) {
            logger.error('[walletController][getWallets]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const createWallet = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const network = _.get(req, 'query.network', 'BEP20');
            const wallet = await user.createWallet(network);
            const {data} = wallet;
            res.status(200).json({
                address: data.address,
                privateKey: wallet.getPrivateKey(),
                network: data.network,
            });
        } catch (error) {
            logger.error('[walletController][createWallet]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const importWallet = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const address = _.get(req, 'query.address');
            const network = _.get(req, 'query.network', 'BEP20');
            if (!address || !network) {
                res.status(400).json({
                    code: 400,
                    message: 'Missing parameters',
                });
                return;
            }

            const wallet = await user.importWallet(address, network);
            const {data} = wallet;
            res.status(200).json({
                address: data.address,
                network: data.network,
            });
        } catch (error) {
            logger.error('[walletController][importWallet]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const importPrivateKey = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const key = _.get(req, 'query.key');
            const network = _.get(req, 'query.network', 'BEP20');
            if (!key || !network) {
                res.status(400).json({
                    code: 400,
                    message: 'Missing parameters',
                });
                return;
            }

            const wallet = await user.importPrivateKey(key, network);
            const {data} = wallet;
            res.status(200).json({
                address: data.address,
                network: data.network,
            });
        } catch (error) {
            logger.error('[walletController][importPrivateKey]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const getPrivateKey = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const address = _.get(req, 'query.address');
            const password = _.get(req, 'query.password');
            if (!address || !password) {
                res.status(400).json({
                    code: 400,
                    message: 'Missing parameters',
                });
                return;
            }
            const hash = getPasswordHash(password);
            if (user.passwordHash !== hash) {
                res.status(400).json({
                    code: 400,
                    message: 'cabinetWalletPrivate_wrong_password',
                });
                return;
            }
            const wallet = user.getWallet(address);
            if (!wallet) {
                res.status(400).json({
                    code: 400,
                    message: 'Wrong wallet',
                });
                return;
            }
            const privateKey = wallet.getPrivateKey();
            if (!privateKey) {
                res.status(400).json({
                    code: 400,
                    message: 'Wrong wallet',
                });
                return;
            }

            res.status(200).json(privateKey);
        } catch (error) {
            logger.error('[walletController][getPrivateKey]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const getBalances = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const address = _.get(req, 'query.address');
            const wallet = user.getWallet(address);
            if (!wallet) {
                res.status(400).json({
                    code: 400,
                    message: 'Wrong wallet',
                });
                return;
            }
            const balances = await wallet.getBalances();
            res.status(200).json(balances);
        } catch (error) {
            logger.error('[walletController][getBalances]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const deleteWallet = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const address = _.get(req, 'query.address');
            user.deleteWallet(address);
            res.status(200).json({address});
        } catch (error) {
            logger.error('[walletController][deleteWallet]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const transfer = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const address = _.get(req, 'query.address');
            const token = _.get(req, 'query.token', 'nrfx');
            const amount = Number(_.get(req, 'query.amount'));

            const network = token === 'ton' ? 'TON' : 'BEP20';

            if (!address || !amount) {
                res.status(400).json({
                    code: 400,
                    message: 'Missing parameters',
                });
                return;
            }

            const wallet = user.wallets.find(w => w.data.network === network);
            const result = await wallet.transfer(address, token, amount);
            res.status(200).json({
                address,
                ...result,
            });
        } catch (error) {
            logger.error('[walletController][transfer]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const getDefaultAccountBalances = (req, res) => {
    (async () => {
        try {
            const network = _.get(req, 'query.network', 'BEP20');
            const service = getService(network);

            const balances = await service.getDefaultAccountBalances();
            res.status(200).json(balances);
        } catch (error) {
            logger.error('[walletController][getDefaultAccountBalances]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

module.exports = {
    createWallet,
    importWallet,
    importPrivateKey,
    getWallets,
    getPrivateKey,
    getBalances,
    deleteWallet,
    transfer,
    getDefaultAccountBalances,
};
