const _ = require('lodash');
const logger = require('../utils/logger');
const web3Service = require('../services/web3');
const db = require('../models/db');
const telegram = require('../services/telegram');

const saveKYC = async (data) => {
  try {
    const accountAddress = _.get(data, 'externalUserId');
    const result = _.get(data, 'reviewResult.reviewAnswer');
    const isTest = _.get(data, 'sandboxMode', true);
    telegram.log(`New KYC ${accountAddress} ${result}`);
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
