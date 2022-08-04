const axios = require('axios');
const https = require('https');
const _ = require('lodash');
const logger = require('./logger');

const TIMEOUT_CODE = 'ETIMEDOUT';
const RESET_CODE = 'ECONNRESET';
const ATTEMPTS_COUNT = 5;

class Request {

  constructor(config = {}) {
    this.config = config;
    this.agent = new https.Agent({
      rejectUnauthorized: false
    });
    this.setInstance(config);
    this.maxAttempts = config.maxAttempts || ATTEMPTS_COUNT;
    this.delete = this.del;
    this.urlMod = config.urlMod || (url => url);
    this.paramsMod = config.paramsMod || (params => params);
  }

  setInstance = config => {
    this.instance = axios.create(config);
    return this;
  };
  updateInstance = config => {
    this.config = {...this.config, ...config};
    this.setInstance(this.config);
    return this;
  };

  request(rawUrl, options = {}, attempt = 1) {
    return new Promise((fulfill, reject) => {
      (async () => {
        {
          let response;
          if (!options.method) options.method = 'get';
          const instance = _.get(options, 'tempInstance', this.instance);
          const customUrlMod = _.get(options, 'customUrlMod');
          const url = customUrlMod ? customUrlMod(rawUrl) : this.urlMod(rawUrl);
          const params = this.paramsMod(_.get(options, 'params', {}));

          try {
            response = await instance({
              url,
              httpsAgent: this.agent,
              ...options,
              params,
            });
            fulfill(response.data);
          } catch (error) {
            const isTimeout = error.code === TIMEOUT_CODE;
            const isReset = error.code === RESET_CODE;

            // Run it again if timeout problem
            if (isTimeout || isReset) {
              if (attempt < 0 || attempt === this.maxAttempts) {
                logger.warn('[Request][request] last attempt exceeded', rawUrl);
                reject(error);
              } else {
                try {
                  fulfill(await this.request(rawUrl, options, attempt + 1));
                } catch (error) {
                  logger.error('[request] Attempts exceeded', rawUrl, error);
                  reject(error);
                }
              }
            } else {
              logger.warn('[Request][request] not timeout', rawUrl);
              reject(error);
            }
          }
        }
      })()
    })
  };

  get = (url, options = {}) => this.request(url, {
    ...options,
    method: 'get',
  });

  post = (url, options = {}) => this.request(url, {
    ...options,
    method: 'post',
  });

  del = (url, options = {}) => this.request(url, {
    ...options,
    method: 'delete',
  });
}

const request = new Request();

module.exports = {
  Request,
  request,
};
