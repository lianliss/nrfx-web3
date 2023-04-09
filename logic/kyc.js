const _ = require('lodash');
const logger = require('../utils/logger');
const web3Service = require('../services/web3');
const db = require('../models/db');
const telegram = require('../services/telegram');

const saveKYC = async (accountAddress, data) => {
  try {
    telegram.log(`New KYC ${accountAddress}`);
    return true;
  } catch (error) {
    logger.error('[saveKYC]', accountAddress, data, error);
    telegram.log(`[saveKYC]\n<code>${accountAddress}</code>\n${error.message}`);
    return false;
  }
};

module.exports = {
  saveKYC,
};
