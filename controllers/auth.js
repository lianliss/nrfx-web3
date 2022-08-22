const _ = require('lodash');
const logger = require('../utils/logger');
const UserModel = require('../models/user');
const getPasswordHash = require('../models/password-hash');
const web3Service = require('../services/web3');

const auth = (req, res = {}, next = () => {}, callback = () => {}) => {
    (async () => {
        const headers = _.get(req, 'headers', _.get(req, 'httpRequest.headers', {}));
        let appID = _.get(headers, 'x-app-id');
        let token = _.get(headers, 'x-token');

        if (req.webSocketVersion) {
			logger.debug('[auth] websocket attempt', req.webSocketVersion, req.host, req.resource);
            // For websocket connection
            const url = new URL(`http://${req.host}${req.resource}`);
            appID = url.searchParams.get('app');
            token = url.searchParams.get('token');
        }

        if (!appID || !token) {
            res.status && res.status(403).send('Authentication required');
            return;
        }

        try {
            const user = await UserModel.getByAuth(token, appID);
            if (!user) {
                // Wrong credentials
                res.status && res.status(403).send('Authentication required');
                return;
            } else {
                // Successful authorization
                _.set(res, 'locals.user', user);
                next();
                callback(user);
            }
        } catch (error) {
            logger.warn('[auth]', appID, token, headers);
            res.status && res.status(403).send('Authentication required');
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

const authLocal = (req, res = {}, next = () => {}, callback = () => {}) => {
    (async () => {
        try {
            const ipV4 = req.connection.remoteAddress.replace(/^.*:/, '');
            // Check is localhost
            if (ipV4 !== '1') throw new Error();
            next();
            callback();
        } catch (error) {
            res.status(403).send('Authentication required');
            return;
        }
    })()
};

const authWallet = (req, res = {}, next = () => {}, callback = () => {}) => {
  (async () => {
    try {
      const headers = _.get(req, 'headers', _.get(req, 'httpRequest.headers', {}));
      let sign = _.get(headers, 'nrfx-sign');
      let message = `Sign up with code ${_.get(headers, 'nrfx-message', '')}`;
      const account = await web3Service.web3.eth.accounts.recover(
        web3Service.web3.utils.utf8ToHex(message),
        sign,
      );
      logger.debug('[authWallet] account', account);
      _.set(res, 'locals.accountAddress', account);
      next();
      callback();
    } catch (error) {

      logger.error('[authWallet]', error);
      res.status(403).send('Authentication required');
      return;
    }
  })()
};

module.exports = {
    auth,
    checkPassword,
    authLocal,
    authWallet,
};
