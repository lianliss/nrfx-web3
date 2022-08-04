const logger = require('../../utils/logger');

class RatesCache {
  list = {};
  promises = {};

  /**
   * Rate getter. Always returns a Promise with number or null in the result
   * @param currency
   * @returns {Promise.<*>}
   */
  get = async currency => {
    const item = this.list[currency];
    const promise = this.promises[currency];

    if (item) {
      try {
        return item.then ? await item : item || null;
      } catch (error) {
        try {
          return promise.then ? await promise : null;
        } catch (error) {
          return null;
        }
      }
    } else {
      if (promise.then) {
        try {
          return await promise;
        } catch (error) {
          return null;
        }
      } else {
        return null;
      }
    }
  };
  /**
   * Rate setter
   * @param currency {string} - currency in lowercase
   * @param item {Promise} - a Promise that returns a number
   */
  set = (currency, item) => {
    if (this.promises[currency]) return;
    if (item && item.then) {
      this.promises[currency] = (async () => {
        try {
          this.list[currency] = await item;
          this.promises[currency] = null;
          return this.list[currency];
        } catch (error) {
          logger.warn(`[RatesCache][set] Can't update ${currency}`);
        }
      })();
    } else {
      if (Number(item)) {
        this.list[currency] = item;
        return this.list[currency];
      }
    }
  };

  /**
   * Async returns an object with rates
   * @returns {Promise.<{}>}
   */
  all = async () => {
    const currencies = Object.keys(this.list);
    try {
      const data = await Promise.allSettled(
        currencies.map(currency => this.get(currency))
      );
      const list = {};
      data.map((item, index) => {
        if (item.status === 'fulfilled') {
          list[currencies[index]] = item.value;
        }
      });
      return list;
    } catch (error) {
      logger.error('[RatesCache][all]', error);
      return [];
    }
  }
}

module.exports = RatesCache;
