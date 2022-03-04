const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
    firstName: {
        field: 'first_name',
    },
    last_name: {
        field: 'last_name',
    },
    login: {},
    email: {},
    roleID: {
        field: 'role',
        type: 'number',
    },
    isActive: {
        field: 'active',
        type: 'boolean',
    },
    isDelete: {
        field: '_delete',
        type: 'boolean',
    },
    isBanned: {
        field: 'ban_id',
        type: 'boolean',
    },
    passwordHash: {
        field: 'password',
    },
    refer: {
        field: 'refer',
    },
    isBonusReceived: {
        field: 'bonus_received',
        type: 'boolean',
    },
    referPercent: {
        field: 'refer_percent',
        type: 'number',
    }
});

const getUserByID = async userID => {
    try {
        const data = await db.query(`
            SELECT
            id, first_name, last_name, login, email, role, active, password, _delete, ban_id,
            refer, bonus_received
            FROM users
            WHERE id = ${userID};
        `);
        return data.length
            ? model.process(data)[0]
            : null;
    } catch (error) {
        logger.error('[getUserByID]', error);
        return null;
    }
};

const setBonusReceived = async (userID, isBonusReceived = true) => {
    try {
        const data = model.encode({userID, isBonusReceived});
        await db.query(`
        UPDATE users
        SET bonus_received = ${data['bonus_received']}
        WHERE id = ${userID};
        `);
        return true;
    } catch (error) {
        logger.error('[setBonusReceived]', error);
        return false;
    }
};

const setReferPercent = async (userID, referPercent) => {
    try {
        const data = model.encode({userID, referPercent});
        await db.query(`
        UPDATE users
        SET refer_percent = ${data['refer_percent']}
        WHERE id = ${userID};
        `);
        return true;
    } catch (error) {
        logger.error('[setReferPercent]', error);
        return false;
    }
};

module.exports = {
    getUserByID,
    setBonusReceived,
    setReferPercent,
};
