const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
    userID: {
        field: 'user_id',
        type: 'number',
    },
    created: {
        field: 'created_at_timestamp',
        type: 'number',
    },
    updated: {
        field: 'updated_at_timestamp',
        type: 'number',
    },
    fromBalance: {
        field: 'from_balance_id',
        type: 'number',
    },
    toBalance: {
        field: 'to_balance_id',
        type: 'number',
    },
    amount: {
        field: 'amount',
        type: 'number',
    },
    type: {
        field: 'type',
        type: 'string',
    },
    extra: {
        field: 'extra',
        type: 'json',
    },
    fromCategory: {
        field: 'from_balance_category',
        type: 'string',
    },
    toCategory: {
        field: 'to_balance_category',
        type: 'string',
    },
    status: {
        field: 'status',
        type: 'string',
    },
});

const addHistoryExchange = async data => {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const parts = model.getRequestParts({
            created: timestamp,
            updated: timestamp,
            ...data,
            toBalance: 1,
            fromCategory: 'fiat',
            toCategory: 'wallet',
            status: 'completed',
            type: 'buy_token',
        });
        const query = `
        INSERT INTO balances_history ${parts.fields}
        VALUES ${parts.values};`;
        return await db.query(query);
    } catch (error) {
        logger.error('[addHistoryExchange]', error);
        return null;
    }
};

module.exports = {
    addHistoryExchange,
};
