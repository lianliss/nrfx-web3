const _ = require('lodash');
const logger = require('../utils/logger');
const swapLogic = require('../logic/swap');

const swapFiatToToken = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const fiat = _.get(req, 'query.fiat');
            const token = _.get(req, 'query.token');
            const fiatAmount = Number(_.get(req, 'query.fiatAmount'));

            if (!fiat || !token || !fiatAmount) {
                return res.status(400).json({
                    code: 400,
                    message: 'Missing parameters',
                });
            }

            const result = await swapLogic.swapFiatToToken({
                user,
                fiat,
                token,
                fiatAmount,
            });
            res.status(200).json(result);
        } catch (error) {
            logger.error('[swapController][swapFiatToToken]', error);
            res.status(500).json({
                code: error.code,
                message: error.message,
            });
        }
    })();
};

const getFiatToTokenRate = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const fiat = _.get(req, 'query.fiat');
            const token = _.get(req, 'query.token');

            if (!fiat || !token) {
                return res.status(400).json({
                    code: 400,
                    message: 'Missing parameters',
                });
            }

            const rate = await swapLogic.getFiatToTokenRate({
                fiat,
                token,
            });
            res.status(200).json({
                fiat,
                token,
                rate,
            });
        } catch (error) {
            logger.error('[swapController][getFiatToTokenRate]', error);
            res.status(500).json({
                code: error.code,
                message: error.message,
            });
        }
    })();
};

module.exports = {
    swapFiatToToken,
    getFiatToTokenRate,
};
