const _ = require('lodash');
const logger = require('../utils/logger');
const {networks} = require('../config');
const {Request} = require('../utils/request');
const errors = require('../models/error');
const {FIATS, FIATS_PAYTYPES, GET_RATE_INTERVAL} = require('../const');
const cache = require('../models/cache');

class BinanceP2P extends Request {
  constructor(config = {}) {
    super({
      urlMod: endpoint => `https://p2p.binance.com/bapi/c2c/v2/${endpoint}`,
      baseUrl: `https://p2p.binance.com/bapi/c2c/v2/`,
      maxAttempts: 1,
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
      cache.rates.set(fiat, (async () => {
        try {
          return 1 / (await this.getFiatUSDPrice(fiat));
        } catch (error) {
          logger.warn('[BinanceP2P][updateRates]', fiat, error);
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

      const payTypes = _.get(FIATS_PAYTYPES, fiatSymbol, ['BANK']);

      const response = await this.post(`friendly/c2c/adv/search`, {
        data: {
          asset: "USDT",
          fiat: fiatSymbol,
          merchantCheck: true,
          page: 1,
          payTypes,
          publisherType: null,
          rows: 10,
          tradeType: "BUY",
          transAmount:  null
        }
      });

      const code = _.get(response, 'code', '');
      const message = _.get(response, 'message');
      const data = _.get(response, 'data');

      if (message) throw new Error(`[${code}] ${message}`);

      let price = 0;
      data.map(item => {
        price += Number(_.get(item, 'adv.price'));
      });
      price /= data.length;

      return price;
    } catch (error) {
      const code = _.get(error, 'response.status', 0);
      const message = `${_.get(error, 'response.statusText', 'Undefined response')} Code: ${code}`;
      const newError = new Error({
        code: code,
        name: message,
        message,
      });
      logger.error('[BinanceP2P][getFiatUSDPrice]', fiat, error);
      throw newError;
    }
  };
}

module.exports = new BinanceP2P();
