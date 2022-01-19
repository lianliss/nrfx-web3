const fs = require('fs');
const logger = require('../utils/logger');

const readJson = async (file = '', encoding = 'utf8') => {
    try {
        logger.debug('[readJson] Try to open', file);
        return JSON.parse(fs.readFileSync(file, encoding));
    } catch (error) {
        logger.error(`[readJson] Unable to read file ${file}`, error);
        return null;
    }
};

const saveJson = async (file = '', data = {}) => {
    logger.debug('[saveJson] Try to save', file);
    try {
        await fs.writeFile(file, JSON.stringify(data), error => {
            if (error) {
                logger.error('Unable to write file', file);
                throw error;
            }
            logger.info("JSON data is saved to", file);
        });
        return true;
    } catch (error) {
        logger.error(`[saveJson] ${file}`, error);
        return false;
    }
};

module.exports = {
    readJson,
    saveJson,
};