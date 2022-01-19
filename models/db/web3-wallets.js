const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
    userID: {
        field: 'user_id',
        type: 'number',
    },
    address: {
        type: 'string',
    },
    privateData: {
        field: 'private_data',
        type: 'json',
    },
    network: {
        type: 'string',
    },
    isGenerated: {
        field: 'is_generated',
        type: 'boolean',
    },
    isTaken: {
        field: 'is_taken',
        type: 'boolean',
    },
    created: {
        field: 'created_timestamp',
        type: 'number',
    },
    updated: {
        field: 'updated_timestamp',
        type: 'number',
    },
});

/**
 * Returns all user wallets
 * @param userID {number}
 * @returns {Promise.<*>}
 */
const getUserWallets = async userID => {
    try {
        const data = await db.query(`
            SELECT *
            FROM web3_wallets
            WHERE user_id = ${userID};
        `);
        return model.process(data);
    } catch (error) {
        logger.error('[getUserWallets]', error);
        return null;
    }
};

/**
 * Updates or inserts a user wallet
 * @param data {object} - wallet data. Mandatory params: userID, address;
 * @returns {Promise.<null>}
 */
const setUserWallet = async data => {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const parts = model.getRequestParts({
            created: timestamp,
            ...data,
            updated: timestamp,
        });
        const query = `
        INSERT INTO web3_wallets ${parts.fields}
        VALUES ${parts.values}
        ON DUPLICATE KEY
        UPDATE
        ${parts.update};`;
        const result = await db.query(query);
    } catch (error) {
        logger.error('[setUserWallet]', error);
        return null;
    }
};

module.exports = {
    getUserWallets,
    setUserWallet,
};
