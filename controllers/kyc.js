const _ = require('lodash');
const logger = require('../utils/logger');
const kycLogic = require('../logic/kyc');

const getAccessToken = async (req, res) => {
  try {
    const {accountAddress} = res.locals;
    
    const tokenData = await kycLogic.createAccessToken(accountAddress);
    res.status(200).json(tokenData);
  } catch (error) {
    logger.error('[getAccessToken]', error);
  }
};

module.exports = {
  getAccessToken,
};
