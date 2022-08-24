const _ = require('lodash');
const logger = require('../utils/logger');
const {networks} = require('../config');
const {Request} = require('../utils/request');
const errors = require('../models/error');
const {FIATS, GET_RATE_INTERVAL} = require('../const');
const cache = require('../models/cache');

class Coinbase extends Request {
  constructor(config = {}) {
    super({
      urlMod: endpoint => `https://api.coinbase.com/v2/${endpoint}`,
      baseUrl: `https://api.coinbase.com/v${_.get(config, 'apiVersion', 2)}/`,
      maxAttempts: 1,
      ...config,
    });
    //this.updateRates();
    //this.interval = setInterval(this.updateRates, GET_RATE_INTERVAL);
  };

  /**
   * Updates fiats rates in the cache
   */
  updateRates = () => {
    FIATS.map(fiat => {
      cache.rates.set(fiat, (async () => {
        try {
          return 1 / (await this.getFiatUSDPrice(fiat));
        } catch (error) {
          logger.warn('[Coinbase][updateRates]', fiat, error);
          return null;
        }
      })());
    })
  };

  /**
   * Returns currency amount for 1 USD
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
      const code = _.get(error, 'response.status', 0);
      const message = `${_.get(error, 'response.statusText', 'Undefined response')} Code: ${code}`;
      const newError = new Error({
        code: code,
        name: message,
        message,
      });
      logger.error('[Coinbase][getFiatUSDPrice]', fiat, error);
      throw newError;
    }
  };
}

module.exports = new Coinbase();
