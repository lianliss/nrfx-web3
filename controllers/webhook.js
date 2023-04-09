const _ = require('lodash');
const logger = require('../utils/logger');
const kycLogic = require('../logic/kyc');
const {sumsub} = require('../config');

const processKYC = async (req, res) => {
  try {
    const headers = _.get(req, 'headers', _.get(req, 'httpRequest.headers', {}));
    if (headers['x-app-id'] !== sumsub.appID || headers['x-token'] !== sumsub.token) {
      return res.status(403).send();
    }
    
    await kycLogic.saveKYC(req.body);
    res.status(200).send();
  } catch (error) {
    logger.error('[processKYC]', error);
  }
};

module.exports = {
  processKYC,
};
