const _ = require('lodash');
const logger = require('../utils/logger');
const errors = require('../models/error');
const web3Service = require('../services/web3');
const db = require('../models/db');
const wei = require('../utils/wei');
const telegram = require('../services/telegram');
const isLocal = process.env.NODE_ENV === 'local';
const LogsDecoder = require('logs-decoder');

const processLog = data => {
  try {
  
  } catch (error) {
    logger.error('[p2p][processLog]', error, data);
    telegram.log(`[p2p][processLog] error: ${error.message}`);
  }
};

module.exports = {
  processLog,
};
