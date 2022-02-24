const _ = require('lodash');
const logger = require('../utils/logger');
const User = require('../models/user');

const sendFiatBalanceToUser = (req, res) => {
    (async () => {
        try {
            const userID = Number(_.get(req, 'query.userID'));
            if (!userID) return res.status(400).json({
                name: 'missing_parameters',
                message: 'Missing parameters',
            });

            const user = await User.getByID(userID);
            const fiats = (await user.getFiats()).map(fiat => {
                delete fiat.userID;
                delete fiat.locked;
                return fiat;
            });

            // Send to stream
            user.sendJson({
                type: 'fiats',
                data: fiats,
            });

            res.status(200).send('Sended');
        } catch (error) {
            logger.error('[sendFiatBalanceToUser]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

module.exports = {
    sendFiatBalanceToUser,
};
