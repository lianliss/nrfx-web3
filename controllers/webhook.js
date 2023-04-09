const _ = require('lodash');
const logger = require('../utils/logger');
const kycLogic = require('../logic/kyc');

const processKYC = async (req, res) => {
  try {
    logger.debug('[processKYC]', req);
    const headers = _.get(req, 'headers', _.get(req, 'httpRequest.headers', {}));
    logger.debug('[processKYC] headers', headers);
    await kycLogic.saveKYC(req.body);
    res.status(200).send();
  } catch (error) {
    logger.error('[processKYC]', error);
  }
};

module.exports = {
  processKYC,
};
