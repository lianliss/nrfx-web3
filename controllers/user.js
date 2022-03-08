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

module.exports = {
    getUserData,
    setReferPercent,
};