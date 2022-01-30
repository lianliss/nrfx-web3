const _ = require('lodash');
const logger = require('../utils/logger');
const pancake = require('../services/pancake');
const coinbase = require('../services/coinbase');

const getFiatUSDPrice = (req, res) => {
    (async () => {
        try {
            const currency = _.get(req, 'query.currency');
            const price = await coinbase.getFiatUSDPrice(currency);
            res.status(200).json({
                currency,
                price,
            });
        } catch (error) {
            logger.error('[ratesController][getFiatUSDPrice]', error);
            res.status(500).json({
                code: error.code,
                message: error.message,
            });
        }
    })();
};

const getTokenUSDPrice = (req, res) => {
    (async () => {
        try {
            const currency = _.get(req, 'query.currency');
            const price = await coinbase.getTokenUSDPrice(currency);
            res.status(200).json({
                currency,
                price,
            });
        } catch (error) {
            logger.error('[ratesController][getFiatUSDPrice]', error);
            res.status(500).json({
                code: error.code,
                message: error.message,
            });
        }
    })();
};

module.exports = {
    getFiatUSDPrice,
    getTokenUSDPrice,
};


