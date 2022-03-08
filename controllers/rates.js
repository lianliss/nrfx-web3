const _ = require('lodash');
const logger = require('../utils/logger');
const cache = require('../models/cache');

/**
 * Returns currency's USD price from cache
 * @param req
 * @param res
 */
const getCurrencyUSDPrice = (req, res) => {
    (async () => {
        try {
            const currency = _.get(req, 'query.currency');
            const price = await cache.rates.get(currency.toLowerCase());
            res.status(200).json({
                currency,
                price,
            });
        } catch (error) {
            logger.error('[ratesController][getCurrencyUSDPrice]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

/**
 * Returns all known currencies rates in object
 * @param req
 * @param res
 */
const getAllRates = (req, res) => {
    (async () => {
        try {
            res.status(200).json(await cache.rates.all());
        } catch (error) {
            logger.error('[ratesController][getAllRates]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

module.exports = {
    getCurrencyUSDPrice,
    getAllRates,
};


