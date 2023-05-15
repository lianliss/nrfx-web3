const _ = require('lodash');
const logger = require('../utils/logger');
const cache = require('../models/cache');
const db = require('../models/db');
const errors = require('../models/error');
const {request} = require('../utils/request');
const web3Service = require('../services/web3');
const Web3 = require('web3');

const getOffers = (req, res) => {
  (async () => {
    try {
      const currency = _.get(req, 'query.currency');
      const bank = _.get(req, 'query.bank');
      const side = _.get(req, 'query.side');
      res.status(200).json(await db.getOffers(currency, bank, side));
    } catch (error) {
      logger.error('[offersController][getOffers]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getOffer = (req, res) => {
  (async () => {
    try {
      const offerAddress = _.get(req, 'query.offerAddress');
      res.status(200).json(await db.getOffer(offerAddress));
    } catch (error) {
      logger.error('[offersController][getOffers]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getValidatorOffers = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      res.status(200).json(await db.getValidatorOffers(accountAddress));
    } catch (error) {
      logger.error('[offersController][getOffers]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

module.exports = {
  getOffers,
  getOffer,
  getValidatorOffers,
};
