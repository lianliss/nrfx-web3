const RatesCache = require('./rates');

module.exports = {
    users: {},
    usersByTokens: {},
    rates: new RatesCache(),
};
