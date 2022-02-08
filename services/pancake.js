const _ = require('lodash');
const logger = require('../utils/logger');
const {networks} = require('../config');
const {Request} = require('./request');
const errors = require('../models/error');

class Pancake extends Request {
    constructor(config = {}) {
        super({
            baseUrl: `https://api.pancakeswap.info/api/v${_.get(config, 'apiVersion', 2)}/`,
            ...config,
        });
    }
    getTokenInfo = async (token, network = 'BEP20') => {
        try {
            const lowercaseToken = token.toLowerCase();
            const tokenOverride = lowercaseToken === 'bnb'
                ? 'wbnb'
                : lowercaseToken;
            const address = _.get(networks, `${network.toUpperCase()}.contracts.${tokenOverride}.address`);
            if (!address) throw new errors.WrongTokenError();

            const response = await this.get(`tokens/${address}`);
            return response.data;
        } catch (error) {
            logger.error('[Pancake][getTokenInfo]', token, network, error);
            throw error;
        }
    };
    getTokenUSDPrice = async (token, network = 'BEP20') => {
        try {
            const tokenSymbol = token.toLowerCase();
            if (tokenSymbol === 'usdt') return 1;

            const data = await this.getTokenInfo(token, network);
            return Number(data.price);
        } catch (error) {
            logger.error('[Pancake][getTokenUSDPrice]', token, network, error);
            throw error;
        }
    };
    getTokenBNBPrice = async (token, network = 'BEP20') => {
        try {
            const tokenSymbol = token.toLowerCase();
            if (tokenSymbol === 'bnb') return 1;

            const data = await this.getTokenInfo(token, network);
            return Number(data.price_BNB);
        } catch (error) {
            logger.error('[Pancake][getTokenBNBPrice]', token, network, error);
            throw error;
        }
    };
}

module.exports = new Pancake();
