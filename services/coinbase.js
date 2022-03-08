const _ = require('lodash');
const logger = require('../utils/logger');
const {networks} = require('../config');
const {Request} = require('./request');
const errors = require('../models/error');
const {FIATS, GET_RATE_INTERVAL} = require('../const');
const cache = require('../models/cache');

class Coinbase extends Request {
    constructor(config = {}) {
        super({
            baseUrl: `https://api.coinbase.com/v${_.get(config, 'apiVersion', 2)}/`,
            ...config,
        });
        this.updateRates();
        this.interval = setInterval(this.updateRates, GET_RATE_INTERVAL);
    };

    /**
     * Updates fiats rates in the cache
     */
    updateRates = () => {
        FIATS.map(fiat => {
            cache.rates.set(fiat, this.getFiatUSDPrice(fiat));
        })
    };

    /**
     * Returns USD price for currency
     * @param fiat
     * @returns {Promise.<number>}
     */
    getFiatUSDPrice = async fiat => {
        try {
            const fiatSymbol = fiat.toUpperCase();
            if (fiatSymbol === 'USD') return 1;

            const response = await this.get(`prices/USD-${fiatSymbol}/spot`);
            return Number(response.data.amount);
        } catch (error) {
            logger.error('[Coinbase][getFiatUSDPrice]', fiat, error);
            throw error;
        }
    };
}

module.exports = new Coinbase();
