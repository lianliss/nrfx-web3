const _ = require('lodash');
const logger = require('../utils/logger');
const cache = require('../models/cache');
const db = require('../models/db');
const telegram = require('../services/telegram');
const withdrawLogic = require('../logic/withdraw');

const addWithdraw = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const amount = Number(_.get(req, 'query.amount', 0));
      const currency = _.get(req, 'query.currency', '').toUpperCase();
      const accountNumber = _.get(req, 'query.accountNumber');
      const accountHolder = _.get(req, 'query.accountHolder').toUpperCase();
      const bank = _.get(req, 'query.bank');
      const phone = _.get(req, 'query.phone', '');
      const networkID = _.get(req, 'query.networkID', 'BSC');

      await withdrawLogic.startWithdraw({
        accountAddress,
        amount,
        currency,
        accountNumber,
        accountHolder,
        bank,
        phone,
        networkID,
      });

      res.status(200).json({status: 'ok'});
    } catch (error) {
      logger.error('[withdrawController][addWithdraw]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getWithdrawalBanks = (req, res) => {
  (async () => {
    try {
      res.status(200).json(withdrawLogic.WITHDRAWAL_BANKS);
    } catch (error) {
      logger.error('[withdrawController][getWithdrawalBanks]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

module.exports = {
  addWithdraw,
  getWithdrawalBanks,
};
