const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
    name: {
        type: 'string',
    },
    key: {
        type: 'json',
    },
    encryption: {
        type: 'string',
    }
});

const getMasterKeys = async () => {
    try {
        return model.process(await db.query(`
            SELECT *
            FROM master_keys;
        `));
    } catch (error) {
        logger.error('[getMasterKey]', error);
        return null;
    }
};

module.exports = {
    getMasterKeys,
};
