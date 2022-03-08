const logger = require('../../utils/logger');

class RatesCache {
    list = {};

    /**
     * Rate getter. Always returns a Promise with number or null in the result
     * @param currency
     * @returns {Promise.<*>}
     */
    get = async currency => {
        const item = this.list[currency];

        if (item && item.then) {
            // If the item is a Promise
            try {
                return await item;
            } catch (error) {
                logger.error('[RatesCache]', error);
                return null;
            }
        } else {
            return item || null;
        }
    };
    /**
     * Rate setter
     * @param currency {string} - currency in lowercase
     * @param item {Promise} - a Promise that returns a number
     */
    set = (currency, item) => {
        this.list[currency] = item;
    };

    /**
     * Async returns an object with rates
     * @returns {Promise.<{}>}
     */
    all = async () => {
        const currencies = Object.keys(this.list);
        const data = await Promise.all(
            currencies.map(currency => this.get(currency))
        );
        const list = {};
        data.map((item, index) => {
            list[currencies[index]] = item;
        });
        return list;
    }
}

module.exports = RatesCache;
