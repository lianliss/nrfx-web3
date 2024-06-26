const _ = require('lodash');
const logger = require('../utils/logger');
const db = require('../models/db');

const getUserData = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;

            res.status(200).json({
                referPercent: user.referPercent,
                login: user.login,
            });
        } catch (error) {
            logger.error('[userController][getUserData]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const setReferPercent = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;

            const settings = await db.getSiteSettings();
            const defaultAgentPercent = Number(settings.agent_percent) || 0;
            const defaultReferPercent = Number(settings.default_refer_percent) || 0;

            let percent = Number(_.get(req, 'query.percent', defaultReferPercent));
            if (percent < 0) percent = 0;
            if (percent > defaultAgentPercent) percent = defaultAgentPercent;

            user.referPercent = percent;
            await db.setReferPercent(user.userID, percent);

            res.status(200).json({
                referPercent: percent,
            });
        } catch (error) {
            logger.error('[userController][setReferPercent]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const setUserTelegramID = (req, res) => {
  (async () => {
    try {
      const {user} = res.locals;
      const telegramID = Number(_.get(req, 'query.telegramID'));
      if (!telegramID) {
        return res.status(400).json({
          code: 400,
          message: 'Missing parameters',
        });
      }

      const result = await user.setTelegramID(telegramID);

      res.status(200).json({
        userID: user.userID,
        result,
        telegramID,
      });
    } catch (error) {
      logger.error('[userController][setUserTelegramID]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const setP2pUserTelegram = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const telegramID = Number(_.get(req, 'query.telegramID'));
      if (!telegramID) {
        return res.status(400).json({
          code: 400,
          message: 'Missing parameters',
        });
      }
      
      const result = await db.setP2pUserTelegram(accountAddress, telegramID);
      
      res.status(200).json({
        result,
        telegramID,
      });
    } catch (error) {
      logger.error('[userController][setP2pUserTelegram]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const setP2pUserSettings = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const settings = JSON.parse(_.get(req, 'query.settings'));
      
      const result = await db.setP2pUserSettings(accountAddress, settings);
      
      res.status(200).json({
        result,
        settings,
      });
    } catch (error) {
      logger.error('[userController][setP2pUserSettings]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getP2pUserSettings = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      
      const result = await db.getP2pUser(accountAddress);
      
      res.status(200).json(_.get(result, 'settings'));
    } catch (error) {
      logger.error('[userController][getP2pUserSettings]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

const getP2pUserTelegram = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const user = await db.getP2pUser(accountAddress);
      
      res.status(200).json({
        telegram: _.get(user, 'telegram'),
      });
    } catch (error) {
      logger.error('[userController][getP2pUserTelegram]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

module.exports = {
    getUserData,
    setReferPercent,
    setUserTelegramID,
    setP2pUserTelegram,
    setP2pUserSettings,
    getP2pUserTelegram,
    getP2pUserSettings,
};
