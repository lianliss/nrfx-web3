const _ = require('lodash');
const logger = require('../utils/logger');
const cache = require('../models/cache');
const db = require('../models/db');
const errors = require('../models/error');
const {request} = require('../utils/request');
const web3Service = require('../services/web3');
const Web3 = require('web3');
const {binance} = require('../services/binance');
const oracleLogic = require('../logic/oracle');

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

const getCommissions = (req, res) => {
    (async () => {
        try {
            const settings = await db.getSiteSettings();
            res.status(200).json(settings.commissions || {});
        } catch (error) {
            logger.error('[ratesController][getCommissions]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const updateCommissions = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            const data = _.get(req, 'query.data');
            if (!user.isAdmin) throw new errors.PermissionDeniedError();
            if (!data) throw new errors.MissingParametersError();
          
            const dataObject = JSON.parse(data);
            await oracleLogic.updateCommissions(dataObject);
            res.status(200).json(dataObject);
        } catch (error) {
            logger.error('[ratesController][updateCommissions]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const getEtherNarfexSupply = (req, res) => {
    (async () => {
        try {
            const data = await request.get('https://api.etherscan.com/api?module=stats&action=tokensupply&contractaddress=0x155cd154b4c3Afc2719601b617e52526a520d301&apikey=KRQYJW6QSQYZP543KAA5YBGAP13NAVHZAY');
            res.status(200).send(web3Service.fromWei(data.result));
        } catch (error) {
            logger.error('[ratesController][getEtherNarfexSupply]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const getLimits = (req, res) => {
  (async () => {
    try {
      res.status(200).json(binance.coins.map(coin => ({...coin, balance: null})));
    } catch (error) {
      logger.error('[ratesController][getLimits]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getBinanceBalance = (req, res) => {
  (async () => {
    try {
      res.status(200).json(binance.coins);
    } catch (error) {
      logger.error('[ratesController][getLimits]', error);
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
    getCommissions,
    updateCommissions,
    getEtherNarfexSupply,
    getLimits,
    getBinanceBalance,
};


