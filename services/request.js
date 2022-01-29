const axios = require('axios');
const _ = require('lodash');
const logger = require('../utils/logger');

const TIMEOUT_CODE = 'ETIMEDOUT';
const RESET_CODE = 'ECONNRESET';
const ATTEMPTS_COUNT = 5;

class Request {

    constructor(config = {}) {
        this.config = config;
        this.setInstance(config);
        this.maxAttempts = config.maxAttempts || ATTEMPTS_COUNT;
        this.delete = this.del;
    }

    setInstance = config => {
        this.instance = axios.create(config);
        return this;
    };

    request(urlPath, options = {}, attempt = 1) {
        return new Promise((fulfill, reject) => {
            (async () => {
                {
                    let response;
                    if (!options.method) options.method = 'get';
                    const instance = _.get(options, 'tempInstance', this.instance);
                    const baseUrl = _.get(this, 'config.baseUrl', '');
                    const url = `${this.config.baseUrl}${urlPath}`;
                    const params = _.get(options, 'params', {});

                    try {
                        response = await instance({
                            url,
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
                                reject(error);
                            } else {
                                fulfill(await this.request(urlPath, options, attempt + 1));
                            }
                        } else {
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
