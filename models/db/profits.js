const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');
const moment = require('moment');

const model = new DataModel({
    agentID: {
        field: 'user_id',
        type: 'number',
    },
    referID: {
        field: 'target_id',
        type: 'number',
    },
    type: {},
    amount: {
        type: 'number',
    },
    created: {
        field: 'created_at',
        type: 'string',
    },
    timestamp: {
        field: 'created_at_timestamp',
        type: 'number',
    },
    currency: {},
});

const addReferProfit = async data => {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const parts = model.getRequestParts({
            created: moment().format('YYYY-MM-DD HH:mm:ss'),
            timestamp,
            ...data,
            type: 'referral_profit',
        });
        const query = `
        INSERT INTO profits ${parts.fields}
        VALUES ${parts.values};`;
        return await db.query(query);
    } catch (error) {
        logger.error('[addReferProfit]', error);
        return null;
    }
};

module.exports = {
    addReferProfit,
};
