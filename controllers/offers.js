const _ = require('lodash');
const logger = require('../utils/logger');
const cache = require('../models/cache');
const db = require('../models/db');
const errors = require('../models/error');
const {request} = require('../utils/request');
const web3Service = require('../services/web3');
const Web3 = require('web3');
const p2pSubscription = require('../services/subscribtion');

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

const getBanks = (req, res) => {
  (async () => {
    try {
      const currency = _.get(req, 'query.currency');
      res.status(200).json(await db.getCurrencyBanks(currency));
    } catch (error) {
      logger.error('[offersController][getBanks]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const updateOffer = (req, res) => {
  (async () => {
    try {
      const offerAddress = _.get(req, 'query.offerAddress', 0);
      const isBuy = !!_.get(req, 'query.isBuy', true);
      const networkID = _.get(req, 'query.networkID', 'BSC');
      await p2pSubscription.updateOffer(networkID, offerAddress, isBuy);
      res.status(200).json({status: 'updated'});
    } catch (error) {
      logger.error('[offersController][getBanks]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const updateOfferTerms = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const offerAddress = _.get(req, 'query.offerAddress', 0);
      const terms = _.get(req, 'query.terms', '');
      const networkID = _.get(req, 'query.networkID', 'BSC');
      
      const offer = await db.getOffer(offerAddress);
      if (offer.owner !== accountAddress) throw new Error('Wrong offer owner');
      const settings = JSON.parse(offer.settings);
      settings.terms = terms;
      db.setOfferSettings(offerAddress, settings);
      
      res.status(200).json(settings);
    } catch (error) {
      logger.error('[offersController][updateOfferTerms]', error);
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
  getBanks,
  updateOffer,
  updateOfferTerms,
};
