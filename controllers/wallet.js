const _ = require('lodash');
const logger = require('../utils/logger');
const getPasswordHash = require('../models/password-hash');

const getWallets = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const wallets = user.wallets.map(w => ({
                address: w.data.address,
                network: w.data.network,
                isGenerated: !!w.data.isGenerated,
            }));
            res.status(200).json(wallets);
        } catch (error) {
            logger.error('[walletController][getWallets]', error);
            res.status(500).json({
                code: error.code,
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
                code: error.code,
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
            const network = _.get(req, 'query.network');
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
                code: error.code,
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
                    message: 'Wrong password',
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
                code: error.code,
                message: error.message,
            });
        }
    })();
};



module.exports = {
    createWallet,
    importWallet,
    getWallets,
    getPrivateKey,
};
