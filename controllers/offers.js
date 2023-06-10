const _ = require('lodash');
const logger = require('../utils/logger');
const cache = require('../models/cache');
const db = require('../models/db');
const errors = require('../models/error');
const {request} = require('../utils/request');
const web3Service = require('../services/web3');
const Web3 = require('web3');
const p2pSubscription = require('../services/subscribtion');
const telegram = require('../services/telegram');

const getOffers = (req, res) => {
  (async () => {
    try {
      const networkID = _.get(req, 'query.networkID', 'BSCTest');
      const currency = _.get(req, 'query.currency');
      const bank = _.get(req, 'query.bank');
      const side = _.get(req, 'query.side');
      const amount = _.get(req, 'query.amount');
      res.status(200).json(await db.getOffers({
        currency, bank, side, networkID, amount,
      }));
    } catch (error) {
      logger.error('[offersController][getOffers]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getTrades = (req, res) => {
  (async () => {
    try {
      const networkID = _.get(req, 'query.networkID', 'BSCTest');
      const trader = web3Service.web3.utils.toChecksumAddress(_.get(req, 'query.trader'));
      const client = web3Service.web3.utils.toChecksumAddress(_.get(req, 'query.client'));
      const status = _.get(req, 'query.status');
      const lawyer = web3Service.web3.utils.toChecksumAddress(_.get(req, 'query.lawyer'));
      const offer = web3Service.web3.utils.toChecksumAddress(_.get(req, 'query.offer'));
      const side = _.get(req, 'query.side');
      res.status(200).json(await db.getTrades({
        trader, client, networkID, status, lawyer, side, offer,
      }));
    } catch (error) {
      logger.error('[offersController][getTrades]', error);
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
      res.status(200).json(await db.getOffer(web3Service.web3.utils.toChecksumAddress(offerAddress)));
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
      if (currency) {
        res.status(200).json(await db.getCurrencyBanks(currency));
      } else {
        res.status(200).json(await db.getAllBanks());
      }
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
      await p2pSubscription.updateOffer(networkID, web3Service.web3.utils.toChecksumAddress(offerAddress), isBuy);
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

const getOfferBanks = (req, res) => {
  (async () => {
    try {
      const offerAddress = _.get(req, 'query.offerAddress', 0);
      let settings = await db.getOfferSettings(offerAddress);
      try {
        settings = JSON.parse(settings);
      } catch (error) {
      }
      
      res.status(200).json(settings.banks);
    } catch (error) {
      logger.error('[offersController][getOfferBanks]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const updateOfferBanks = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const offerAddress = _.get(req, 'query.offerAddress', 0);
      let banks = _.get(req, 'query.banks', []);
      try {
        banks = JSON.parse(banks);
      } catch (error) {
      
      }
      
      const offer = await db.getOffer(offerAddress);
      if (offer.owner !== accountAddress) throw new Error('Wrong offer owner');
      let settings;
      try {
        settings = JSON.parse(offer.settings);
      } catch (error) {
        settings = offer.settings;
      }
      settings.banks = banks;
      db.setOfferSettings(offerAddress, settings);
      
      res.status(200).json(settings);
    } catch (error) {
      logger.error('[offersController][updateOfferBanks]', error);
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

const setTradeIsPayed = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const chat = _.get(req, 'query.chat', '');
      
      const trade = (await db.getTrades({chat}))[0];
      if (!trade) {
        return res.status(200).json({});
      }
      if (trade.side === 'buy') {
        let message = `<b>${trade.side.toUpperCase()} trade marked as payed</b>`;
        message += `\nBy client: <code>${trade.client}</code>`;
        telegram.sendToUser(trade.trader, message, {
          links: [
            {title: 'See trade', url: `http://testnet.narfex.com/dapp/p2p/order/${trade.offer}/${trade.client}`}
          ]
        });
        if (accountAddress === trade.client) {
          const result = await db.setTradeIsPayed(trade.id);
          return res.status(200).json({
            ...trade,
            isPayed: true,
          });
        }
      } else {
        if (accountAddress === trade.trader) {
          const result = await db.setTradeIsPayed(trade.id);
          return res.status(200).json({
            ...trade,
            isPayed: true,
          });
        }
      }
      
      res.status(200).json(trade);
    } catch (error) {
      logger.error('[offersController][setTradeIsPayed]', error);
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
  getOfferBanks,
  updateOfferBanks,
  updateOffer,
  updateOfferTerms,
  getTrades,
  setTradeIsPayed,
};
