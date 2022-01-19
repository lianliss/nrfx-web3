const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');

const getUserIDByAuth = async (token, appID) => {
    try {
        const data = await db.query(`
            SELECT owner_id
            FROM apps_tokens
            WHERE token = '${token}'
            AND app_id = ${appID};
        `);
        return data.length
            ? data[0].owner_id
            : null;
    } catch (error) {
        logger.error('[getUserIDByAuth]', error);
        return null;
    }
};

module.exports = {
    getUserIDByAuth,
};
