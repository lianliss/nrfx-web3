const _ = require('lodash');
const logger = require('../utils/logger');
const db = require('../models/db');
const referLogic = require('../logic/refers');
const {ZERO_ADDRESS, DEFAULT_REFER} = require('../const');

const getHash = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;

      res.status(200).send(await referLogic.getReferHash(accountAddress));
    } catch (error) {
      logger.error('[refersController][getHash]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const setRefer = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const hash = _.get(req, 'query.hash');
      if (!hash) throw Error('No refer hash provided');

      await referLogic.addAccountRefer(accountAddress, hash);

      res.status(200).send(hash);
    } catch (error) {
      logger.error('[refersController][setRefer]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getRefer = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      
      const refer = await referLogic.getAccountRefer(accountAddress);
      if (refer) {
        res.status(200).send(refer.address);
      } else {
        res.status(200).send(ZERO_ADDRESS);
      }
    } catch (error) {
      logger.error('[refersController][getRefer]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getRewards = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;

      const referData = await db.getReferShort(accountAddress);
      if (!referData.length) return res.status(200).json([]);

      const referID = referData[0].id;
      const rewards = await db.getReferRewards(referID);

      res.status(200).json(rewards.map(r => {
        const a = r.account_address;
        return {
          account: `${a.slice(0, 6)}...${a.slice(-4)}`,
          currency: r.currency,
          amount: r.amount,
        };
      }));
    } catch (error) {
      logger.error('[refersController][getRewards]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getInvites = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;

      const referData = await db.getReferShort(accountAddress);
      if (!referData.length) return res.status(200).send(0);

      const referID = referData[0].id;
      const invites = await db.getReferInvites(referID);

      res.status(200).json(invites.map(i => {
        const a = i.account_address;
        return `${a.slice(0, 6)}...${a.slice(-4)}`;
      }));
    } catch (error) {
      logger.error('[refersController][getInvites]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

module.exports = {
  getHash,
  setRefer,
  getRewards,
  getInvites,
};
