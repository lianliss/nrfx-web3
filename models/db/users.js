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
    }
});

const getUserByID = async userID => {
    try {
        const data = await db.query(`
            SELECT id, first_name, last_name, login, email, role, active, password, _delete, ban_id
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

module.exports = {
    getUserByID,
};
