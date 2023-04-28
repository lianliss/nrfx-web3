const _ = require('lodash');
const axios = require('axios');
const logger = require('../utils/logger');
const crypto = require('crypto');
const web3Service = require('../services/web3');
const db = require('../models/db');
const telegram = require('../services/telegram');
const {sumsub} = require('../config');
const FormData = require('form-data');

function createSignature(config) {
  const ts = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256',  sumsub.secret);
  signature.update(ts + config.method.toUpperCase() + config.url);
  
  if (config.data instanceof FormData) {
    signature.update(config.data.getBuffer());
  } else if (config.data) {
    signature.update(config.data);
  }
  
  config.headers['X-App-Access-Ts'] = ts;
  config.headers['X-App-Access-Sig'] = signature.digest('hex');
  
  return config;
}

const createAccessToken = async (externalUserId, levelName = 'basic-kyc-level', ttlInSecs = 600) => {
  try {
    const config = {
      baseURL: sumsub.url,
      method: 'post',
      url: `/resources/accessTokens?userId=${externalUserId}&ttlInSecs=${ttlInSecs}&levelName=${levelName}`,
      headers: {
        'Accept': 'application/json',
        'X-App-Token': sumsub.token,
      },
      data: null,
    };
    const instance = axios.create(config);
    instance.interceptors.request.use(createSignature, function (error) {
      return Promise.reject(error);
    });
    
    const response = await instance(config);
    logger.debug('[kyc][createAccessToken]', response.data);
    return response.data;
  } catch (error) {
    logger.error('[kyc][createAccessToken]', error);
    telegram.log(`[kyc][createAccessToken] ${error.message}`);
  }
};

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
  createAccessToken,
};
