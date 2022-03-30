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

const getBalancesHistory = async () => {
    try {
        return db.query(`
        SELECT
        op.id,
        op.manager_id,
        m.login AS manager,
        c.number AS card,
        op.amount, op.fee,
        op.created_at_timestamp,
        op.user_id,
        u.first_name, u.last_name, u.login, u.email
        FROM bank_cards_operations AS op
        LEFT JOIN users AS u
        ON op.user_id = u.id
        LEFT JOIN users AS m
        ON op.user_id = m.id
        LEFT JOIN bank_cards AS c
        ON op.card_id = c.id
        WHERE
        op.created_at_timestamp >= 1643523562
        AND op.user_id != 4279
        AND op.status = 'confirmed';
        `);
    } catch (error) {
        logger.error('[getBalancesHistory]', error);
        return null;
    }
};

module.exports = {
    addHistoryExchange,
    getBalancesHistory,
};
