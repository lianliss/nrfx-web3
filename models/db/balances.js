const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
    userID: {
        field: 'user_id',
        type: 'number',
    },
    currency: {
        field: 'currency',
        type: 'string',
    },
    amount: {
        field: 'amount',
        type: 'number',
    },
    locked: {
        field: 'lock_amount',
        type: 'number',
    },
});

const getUserFiats = async userID => {
    try {
        return model.process(await db.query(`
            SELECT id, user_id, currency, amount, lock_amount
            FROM balances
            WHERE user_id = ${userID}
            AND category = 'fiat';
        `));
    } catch (error) {
        logger.error('[getUserFiats]', error);
        return null;
    }
};

const decreaseUserFiatBalance = async (userID, currency, amount) => {
    try {
        return db.query(`
        UPDATE balances
        SET amount = amount - ${amount}
        WHERE user_id = ${userID}
        AND currency = '${currency}';
        `);
    } catch (error) {
        logger.error('[updateUserFiatBalance]', error);
        return null;
    }
};

const increaseUserFiatBalance = async (userID, currency, amount) => {
    try {
        return db.query(`
        UPDATE balances
        SET amount = amount + ${amount}
        WHERE user_id = ${userID}
        AND currency = '${currency}';
        `);
    } catch (error) {
        logger.error('[updateUserFiatBalance]', error);
        return null;
    }
};

module.exports = {
    getUserFiats,
    decreaseUserFiatBalance,
    increaseUserFiatBalance,
};
