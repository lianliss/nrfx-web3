const _ = require('lodash');
const logger = require('../utils/logger');
const kycLogic = require('../logic/kyc');

const processKYC = async (req, res) => {
  try {
    logger.debug('[processKYC]', req);
    await kycLogic.saveKYC('test address', {});
    res.status(200).send();
  } catch (error) {
    logger.error('[processKYC]', error);
  }
};

module.exports = {
  processKYC,
};
