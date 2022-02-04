const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
    cardID: {
        field: 'card_id',
        type: 'number',
    },
    userID: {
        field: 'user_id',
        type: 'number',
    },
    status: {
        field: 'status',
        type: 'string',
    },
    created: {
        field: 'created_at_timestamp',
        type: 'number',
    },
    updated: {
        field: 'updated_at_timestamp',
        type: 'number',
    },
});

const getAwaitingBankCardsOperations = async cardID => {
    try {
        return model.process(await db.query(`
            SELECT id, card_id, user_id, status, created_at_timestamp, updated_at_timestamp
            FROM bank_cards_operations
            WHERE status = 'wait_for_pay'
            AND operation = 'book';
        `));
    } catch (error) {
        logger.error('[getAwaitingBankCardsOperations]', error);
        return null;
    }
};

const expireBankCardOperation = async id => {
    try {
        return db.query(`
        UPDATE bank_cards_operations
        SET status = 'expired'
        WHERE id = ${id};
        `);
    } catch (error) {
        logger.error('[expireBankCardOperation]', error);
        return null;
    }
};

module.exports = {
    getAwaitingBankCardsOperations,
    expireBankCardOperation,
};
