const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');

const getSiteSettings = async data => {
    try {
        return await db.query(`SELECT * FROM site_settings LIMIT 1;`)[0];
    } catch (error) {
        logger.error('[getSiteSettings]', error);
        return null;
    }
};

module.exports = {
    getSiteSettings,
};
