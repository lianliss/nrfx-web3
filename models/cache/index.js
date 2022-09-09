const RatesCache = require('./rates');

module.exports = {
    users: {},
    usersByTokens: {},
    usersByTelegram: {},
    rates: new RatesCache(),
};
