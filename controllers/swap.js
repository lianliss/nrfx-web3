const _ = require('lodash');
const logger = require('../utils/logger');
const swapLogic = require('../logic/swap');

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

            const rate = await swapLogic.getFiatToTokenRate(fiat, token);
            res.status(200).json({
                fiat,
                token,
                rate,
            });
        } catch (error) {
            logger.error('[swapController][getFiatToTokenRate]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const exchange = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const fiat = _.get(req, 'query.fiat');
      const coin = _.get(req, 'query.coin');
      const fiatAmount = Number(_.get(req, 'query.fiatAmount')) || 0;
      const coinAmount = Number(_.get(req, 'query.coinAmount')) || 0;
      const networkID = _.get(req, 'query.networkID', 'BSC');

      if (!fiat || !coin || !fiatAmount) {
        return res.status(400).json({
          code: 400,
          message: 'Missing parameters',
        });
      }

      const result = await swapLogic.exchange(
        accountAddress,
        fiat,
        coin,
        fiatAmount,
        coinAmount,
        networkID,
      );
      res.status(200).json(result);
    } catch (error) {
      logger.error('[swapController][exchange]', error);
      res.status(500).json({
        name: _.get(error, 'data.code', error.name),
        message: _.get(error, 'data.msg', error.message),
      });
    }
  })();
};

module.exports = {
    getFiatToTokenRate,
    exchange,
};
