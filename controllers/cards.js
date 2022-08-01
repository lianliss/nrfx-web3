const _ = require('lodash');
const logger = require('../utils/logger');
const cache = require('../models/cache');
const db = require('../models/db');
const errors = require('../models/error');
const {request} = require('../services/request');
const web3Service = require('../services/web3');

const EXPIRATION_DELAY = 60 * 60 * 2; // Two hours

const addReservation = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const amount = Number(_.get(req, 'query.amount', 0));
      const currency = _.get(req, 'query.currency', undefined);
      const bank = _.get(req, 'query.bank', undefined);

      // Check available cards
      const data = await Promise.all([
        await db.getAvailableCards(currency, bank),
        db.getSiteSettings(),
      ]);
      const availableCards = data[0];
      const settings = data[1];
      const feeMultiplier = _.get(settings, 'rub_refill_percent_fee', 2) / 100;
      if (!availableCards.length) {
        res.status(400).json({
          name: 'no_cards_available',
          message: 'no_cards_available',
        });
      }
      const {cardId} = availableCards[0];

      // Reserve the card
      const fee = amount * feeMultiplier;
      await Promise.all([
        db.addCardReservationByWallet(cardId, accountAddress, amount, fee),
        db.reserveTheCard(cardId, Date.now() / 1000 + EXPIRATION_DELAY),
      ]);

      // Get reservation data
      const reservation = await db.getWalletReservation(accountAddress, currency);

      res.status(200).json(reservation);
    } catch (error) {
      logger.error('[cardsController][addReservation]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getReservation = (req, res) => {
  (async () => {
    try {
      const currency = _.get(req, 'query.currency', undefined);
      const accountAddress = _.get(req, 'query.accountAddress', undefined);

      // Get reservation data
      const reservation = await db.getWalletReservation(accountAddress, currency);

      res.status(200).json(reservation);
    } catch (error) {
      logger.error('[cardsController][getReservation]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

module.exports = {
  addReservation,
  getReservation,
};
