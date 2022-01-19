const axios = require('axios');
const https = require('https');
const logger = require('../utils/logger');

const TIMEOUT_CODE = 'ETIMEDOUT';
const RESET_CODE = 'ECONNRESET';
const ATTEMPTS_COUNT = 5;

const agent = new https.Agent({
    rejectUnauthorized: false
});

const get = async (url, attempt = 1) => {
    let response;

    try {
        response = await axios.get(url, {
            httpsAgent: agent,
        });
        return response;
    } catch (error) {
        const isTimeout = error.code === TIMEOUT_CODE;
        const isReset = error.code === RESET_CODE;
        const errorData = isTimeout || isReset ? error.code : error;
        logger.error(`[get] ${url}`, errorData);

        // Run it again if timeout problem
        if (isTimeout || isReset) {
            if (attempt === ATTEMPTS_COUNT) {
                throw errorData;
            } else {
                return await get(url, attempt + 1);
            }
        }
    }
};

module.exports = get;
