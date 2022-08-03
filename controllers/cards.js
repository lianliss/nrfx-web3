const _ = require('lodash');
const logger = require('../utils/logger');
const cache = require('../models/cache');
const db = require('../models/db');
const errors = require('../models/error');
const {request} = require('../services/request');
const web3Service = require('../services/web3');
const topupLogic = require('../logic/topup');
const telegram = require('../services/telegram');
const topupMethods = require('../const/topupMethods');

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

const approveTopup = (req, res) => {
  (async () => {
    try {
      const operationId = _.get(req, 'query.operationId', undefined);

      // Get reservation data
      const receipt = await topupLogic.approveTopup(operationId);

      res.status(200).json({
        receipt,
      });
    } catch (error) {
      logger.error('[cardsController][approveTopup]', error);
      telegram.log(`[cardsController][approveTopup]`, error.message);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const sendToReview = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const operationId = _.get(req, 'query.operationId', undefined);

      db.sendToReview(operationId, accountAddress);
      res.status(200).json({status: 'Ok'});
    } catch (error) {
      logger.error('[cardsController][confirmPayment]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const cancelReservation = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const operationId = _.get(req, 'query.operationId', undefined);

      const reservations = await db.getReservationById(operationId);
      const reservation = reservations[0];
      if (!reservation) throw new Error('No reservation');
      if (reservation.account_address !== accountAddress) throw new Error('You are not the reservation owner');

      await Promise.all([
        db.cancelBooking(operationId),
        db.cancelCardReservation(reservation.cardId),
      ]);
      res.status(200).json({status: 'Ok'});
    } catch (error) {
      logger.error('[cardsController][confirmPayment]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getAvailableBanks = (req, res) => {
  (async () => {
    try {
      const data = await db.getAvailableBanks();
      const banks = {};
      data.map(b => {
        if (!banks[b.bank]) {
          banks[b.bank] = {
            currencies: {},
            code: b.bank,
            title: b.bank,
          };
          const bank = topupMethods.find(m => m.code === b.bank);
          if (bank) banks[b.bank].title = bank.title;
        }
        banks[b.bank].currencies[b.currency] = true;
      });
      const available = Object.keys(banks).map(bank => ({
        ...banks[bank],
        currencies: Object.keys(banks[bank].currencies),
      }));
      res.status(200).json(available);
    } catch (error) {
      logger.error('[cardsController][getAvailableBanks]', error);
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
  approveTopup,
  sendToReview,
  cancelReservation,
  getAvailableBanks,
};
