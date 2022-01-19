const _ = require('lodash');
const logger = require('../utils/logger');
const UserModel = require('../models/user');
const getPasswordHash = require('../models/password-hash');

const auth = (req, res = {}, next = () => {}, callback = () => {}) => {
    (async () => {
        const headers = _.get(req, 'headers', _.get(req, 'httpRequest.headers', {}));
        const appID = _.get(headers, 'x-app-id');
        const token = _.get(headers, 'x-token');

        try {
            const user = await UserModel.getByAuth(token, appID);
            if (!user) {
                res.status(403).send('Authentication required');
                return;
            } else {
                _.set(res, 'locals.user', user);
                next();
                callback(user);
            }
        } catch (error) {
            logger.warn('[auth]', appID, token, headers);
            res.status(403).send('Authentication required');
            return;
        }
    })()
};

const checkPassword = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const password = _.get(req, 'query.password');
            const hash = getPasswordHash(password);
            logger.debug('checkPassword', user.passwordHash, hash);

            res.status(200).send(hash === user.passwordHash ? 'ok' : 'wrong');
        } catch (error) {
            logger.error('[walletController][importWallet]', error);
            res.status(500).json({
                code: error.code,
                message: error.message,
            });
        }
    })();
};

module.exports = {
    auth,
    checkPassword,
};
