const _ = require('lodash');
const logger = require('../utils/logger');
const getPasswordHash = require('../models/password-hash');
const bonusLogic = require('../logic/bonus');

const getWallets = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const bonus = await bonusLogic.getBonusValue(user);
            const wallets = user.wallets.map(w => ({
                address: w.data.address,
                network: w.data.network,
                isGenerated: !!w.data.isGenerated,
                bonus,
            }));
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
            const wallet = await user.createWallet();
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
            logger.error('[walletController][getWallets]', error);
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
            logger.error('[walletController][getWallets]', error);
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
            if (!address || !amount) {
                res.status(400).json({
                    code: 400,
                    message: 'Missing parameters',
                });
                return;
            }

            const result = await user.wallets[0].transfer(address, token, amount);
            res.status(200).json({
                address,
                ...result,
            });
        } catch (error) {
            logger.error('[walletController][deleteWallet]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const receiveBonus = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const result = await bonusLogic.receiveBonus(user);
            res.status(200).json(result);
        } catch (error) {
            logger.error('[walletController][getBonus]', error);
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
    receiveBonus,
};
