const config = require('../config');
const {env, defaultSymbol} = config.binance;
const crypto = require('crypto');
const {Request} = require('../utils/request');
const axios = require('axios');
const stringifyQuery = require('../utils/stringifyQuery');
const logger = require('../utils/logger');
const telegram = require('./telegram');
const _ = require('lodash');
const wait = require('../utils/timeout');
const cache = require('../models/cache');
const {
  GET_BINANCE_RATE_INTERVAL,
  GET_BINANCE_WITHDRAWS_INTERVAL,
} = require('../const');

const getEndpointUrl = endpoint => `${env.url}/sapi/v1${endpoint[0] === '/' ? endpoint : '/' + endpoint}`;
const secondEndpointUrl = endpoint => `${env.url}/api/v3${endpoint[0] === '/' ? endpoint : '/' + endpoint}`;
const buildSign = (data, secret = env.secret) => crypto
  .createHmac('sha256', secret)
  .update(stringifyQuery(data))
  .digest('hex');
const isSign = true;
const isNoKey = true;

class Binance extends Request {

  constructor(config = {}, userCache = null) {
    super({
      headers: {
        'X-MBX-APIKEY': _.get(userCache, 'api_key', env.key),
        'Content-Type': 'application/json',
      },
      maxAttempts: 100,
      urlMod: getEndpointUrl,
      ...config,
    });

    this.apiSecret = _.get(userCache, 'api_secret', env.secret);
    // Promise.all([
    //   this.updateBalance(),
    //   this.exchangeInfo(),
    // ]).then(data => {
    //   const coins = data[0];
    //   const exchange = data[1];
    //   this.exchangeData = exchange;
    //   this.availableSymbols = coins.filter(token => token.coin !== 'USDT')
    //     .map(token => `${token.coin}USDT`)
    //     .filter(symbol => {
    //       return !!exchange.symbols.find(ex => ex.symbol === symbol);
    //     });
    //   this.updateRates(this.availableSymbols);
    // }).catch(error => {
    //   logger.error(`[Binance] Can't start rates updates`, error);
    //   telegram.log(`[Binance] Can't start rates updates: ${error.message}`);
    // });
    // this.updateWithdraws();
  }

  availableSymbols = [];
  coins = [];
  pendingWithdraws = {};

  noKey = {tempInstance: axios};
  signParams = (params = {}) => {
    const data = {
      ...params,
      timestamp: Date.now(),
    };
    const signature = buildSign(data, this.apiSecret);
    return {
      ...data,
      signature,
    }
  };

  ping = () => this.get('ping', {isNoKey});
  time = () => this.get('time', {isNoKey});
  exchangeInfo = () => this.get('exchangeInfo', {
    apiVersion: 2,
    isNoKey
  });
  price = symbol => this.get('ticker/price', {
    isNoKey,
    params: {
      symbol,
    },
  });
  average = symbol => this.get('avgPrice', {
    isNoKey,
    params: {
      symbol,
    },
  });

  getOpenedOrders = symbol => this.get('openOrders', {
    params: {
      symbol,
    },
  });
  getAccount = () => this.get('account', {
    apiVersion: 2,
    isSign,
    params: {},
  });

  newOrder = params => this.post('order', {
    isSign,
    params,
  });

  deleteOrder = (symbol, origClientOrderId) => this.del('order', {
    isSign,
    params: {
      symbol,
      origClientOrderId,
    },
  });

  getPosition = (symbol = defaultSymbol) => this.get('positionRisk', {
    apiVersion: 2,
    isSign,
    params: {
      symbol,
    },
  });

  getLeverageBrackets = () => this.get('leverageBracket', {
    isSign,
    params: {},
  });

  updateLeverage = (symbol, leverage) => this.post('leverage', {
    isSign,
    params: {
      symbol,
      leverage,
    },
  });

  getUserTrades = (symbol, startTime) => {
    const params = {symbol};
    if (startTime) params.startTime = startTime;
    return this.get('userTrades', {
      isSign,
      params,
    })
  };

  getOrderStatus = (symbol, orderId) => this.get('order', {
    isSign,
    params: {
      symbol,
      orderId,
    }
  });

  getStreamKey = () => this.post('listenKey');

  // NEW METHODS

  getAllCoinsInfo = async () => {
    return (await this.get('capital/config/getall', {
      isSign,
    })).filter(token => {
      const bscNetwork = token.networkList.find(n => n.network === 'BSC');
      return token.trading
        && bscNetwork
        && bscNetwork.withdrawEnable;
    });
  };

  applyWithdraw = (
    coin,
    address,
    amount,
    withdrawOrderId,
    network = 'BSC',
  ) => this.post('capital/withdraw/apply', {
    isSign,
    params: {
      coin,
      withdrawOrderId,
      address,
      name: 'Narfex%20Client',
      amount,
      network,
    }
  });

  getWithdrawHistory = () => this.get('capital/withdraw/history', {
    isSign,
    params: {
      limit: 10,
    }
  });

  spotSwap = (
    symbol,
    quoteOrderQty,
    newClientOrderId,
    side = 'BUY', type = 'MARKET',
    ) => this.post('order', {
    isSign,
    apiVersion: 2,
    params: {
      symbol,
      quoteOrderQty,
      newClientOrderId,
      side,
      type,
    }
  });

  getSymbolTicker = (
    symbol,
  ) => this.get('ticker/price', {
    apiVersion: 2,
    params: {
      symbol,
    }
  });

  updateRates = async symbols => {
    try {
      const chunks = _.chunk(symbols, 64);
      let data = [];
      for (let i = 0; i < chunks.length; i++) {
        data = [
          ...data,
          ...(await Promise.allSettled(chunks[i].map(symbol => this.getSymbolTicker(symbol)))),
        ]
      }
      let updates = 0;
      data.map(item => {
        if (item.status === 'fulfilled') {
          cache.rates.set(item.value.symbol, (async () => {
            try {
              return Number(item.value.price);
            } catch (error) {
              return null;
            }
          })());
          updates++;
        } else {
          logger.warn('[updateRates]', item);
        }
      });
    } catch (error) {
      logger.error('[Binance][updateRates]', error);
    }
    this.ratesTimeout = setTimeout(() => this.updateRates(symbols), GET_BINANCE_RATE_INTERVAL);
  };

  getRate = async coin => {
    try {
      return coin === 'USDT'
        ? 1
        : await cache.rates.get(`${coin}USDT`);
    } catch (error) {
      logger.error('[Binance][getRate]', coin, error);
      return 1;
    }
  };

  updateBalance = async () => {
    try {
      const coins = await this.getAllCoinsInfo();
      this.coins = coins.map(coin => {
        const network = coin.networkList.find(n => n.network === 'BSC');
        return {
          coin: coin.coin,
          name: coin.name,
          balance: Number(coin.free) || 0,
          minDecimals: Number(network.withdrawIntegerMultiple) || 0.0000000001,
          fee: Number(network.withdrawFee) || 0,
          min: Number(network.withdrawMin) * 2 || 0,
          max: Number(network.withdrawMax) || Infinity,
          time: Number(network.estimatedArrivalTime) || 5,
        }
      });
      return coins;
    } catch (error) {
      logger.error('[Binance][updateBalance]', error);
      return [];
    }
    this.balanceTimeout = setTimeout(() => this.updateBalance(), GET_BINANCE_RATE_INTERVAL);
  };

  // Withdraws checking loop
  updateWithdraws = async () => {
    try {
      if (Object.keys(this.pendingWithdraws).length) {
        const history = await this.getWithdrawHistory();
        Object.keys(this.pendingWithdraws).map(id => {
          const promise = this.pendingWithdraws[id];
          const withdraw = history.find(w => w.withdrawOrderId === id);
          if (!withdraw) return;

          const status = [
            'Email Sent', 'Cancelled', 'Awaiting Approval', 'Rejected', 'Processing', 'Failure', 'Completed'
          ];

          switch (withdraw.status) {
            case 6: // Completed
              logger.info('[Binance][updateWithdraws]', id, status[withdraw.status]);
              promise.fulfill({
                ...withdraw,
                status: status[withdraw.status],
              });
              delete this.pendingWithdraws[id];
              return;
            case 1: // Cancelled
            case 3: // Rejected
            case 5: // Failure
              logger.warn('[Binance][updateWithdraws]', id, status[withdraw.status]);
              promise.reject({
                ...withdraw,
                status: status[withdraw.status],
              });
              delete this.pendingWithdraws[id];
              return;
            default: // Email Send, Awaiting Approval or Processing
              logger.debug('[Binance][updateWithdraws]', id, status[withdraw.status]);
              return;
          }
        })
      }
    } catch (error) {
      logger.error('[Binance][updateWithdraws]', error);
    }
    this.withdrawsTimeout = setTimeout(() => this.updateWithdraws(), GET_BINANCE_WITHDRAWS_INTERVAL);
  };

  request(rawUrl, origOptions = {}, attempt = 1) {
    return new Promise((fulfill, reject) => {
      (async () => {
        const options = _.cloneDeep(origOptions);

        const apiVersion = _.get(options, 'apiVersion', 1);
        if (apiVersion === 2) options.customUrlMod = secondEndpointUrl;

        if (_.get(options, 'isSign', false)) {
          // Params will be signed with timestamp and signature
          options.params = this.signParams(options.params);
        }
        if (_.get(options, 'isNoKey', false)) {
          // Header with API_KEY will not been sent
          Object.assign(options, this.noKey);
        }
        let attemptDelay = 5000;

        try {
          // Send data to ancestor's request method
          fulfill(await super.request(rawUrl, options));
        } catch (error) {
          const status = Number(_.get(error, 'response.status', _.get(error, 'errno')));
          const statusText = _.get(error, 'response.statusText', _.get(error, 'code'));
          const errorData = _.get(error, 'response');
          const isConnectError = status === -3008;
          const isServerError = status >= 500 && status <= 599;
          const isClientError = status >= 400 && status <= 499;
          // Error logging
          let errorTypeText;
          if (isConnectError) errorTypeText = 'Connection error';
          if (isServerError) errorTypeText = 'Server error';
          if (isClientError) errorTypeText = 'Client error';
          if (!!errorTypeText) {
            logger.error('[Binance][request]', errorTypeText, status, statusText, options.params);
          } else {
            logger.error('[Binance][request]', errorTypeText, error);
          }

          // Run it again if server problem
          if (isServerError && status !== 505 || isConnectError) { // 505 = HTTP Version Not Supported
            if (this.maxAttempts && attempt === this.maxAttempts) {
              logger.error('[Binance][request] Rejected', rawUrl, 'by attempts maximum of', this.maxAttempts);
              telegram.log(`[Binance][request] Rejected ${rawUrl} by attempts maximum of ${this.maxAttempts}`);
              return reject(errorData);
            } else {
              telegram.log(`[Binance][request] ${errorTypeText} ${status} "${statusText}". ${JSON.stringify(options.params)}\nAttempt: ${attempt}`);
              await wait(attemptDelay);
              // Try again this method with original not signed options
              logger.warn('[Binance][request] Try again request to', rawUrl, `attempt #${attempt + 1}`);
              try {
                return fulfill(await this.request(rawUrl, origOptions, attempt + 1));
              } catch (error) {
                logger.error('[Binance][request] Server error attempts', error);
              }
            }
          } else {
            if (isClientError) {
              if (status !== 400) { // Is not Bad request
                logger.error('[Binance][request] Critical binance request error to', rawUrl, status, statusText);
                telegram.log(`[Binance][request] Critical binance request error to ${rawUrl}: (${status}) ${statusText}`);
                return reject(errorData);
              }
              const binanceCode = Number(_.get(error, 'response.data.code'));
              const binanceMessage = _.get(error, 'response.data.msg');
              let isLetTryAgain = false;
              switch (binanceCode) {
                case -1003: // TOO_MANY_REQUESTS: Too many requests queued.
                case -1015: // TOO_MANY_ORDERS: Too many new orders.
                  attemptDelay = 2 * 60 * 1000;
                case -1007: // TIMEOUT: Timeout waiting for response from backend server.
                case -1021: // INVALID_TIMESTAMP: Timestamp for this request is outside of the recvWindow.
                case -1016: // SERVICE_SHUTTING_DOWN: This service is no longer available.
                  isLetTryAgain = true;
                  break;
                default:
              }

              if (isLetTryAgain) {
                if (this.maxAttempts && attempt === this.maxAttempts) {
                  logger.error('[Binance][request] Rejected', rawUrl, 'by attempts maximum of', this.maxAttempts);
                  telegram.log(`[Binance][request] Rejected ${rawUrl} by attempts maximum of ${this.maxAttempts}`);
                  return reject(errorData);
                } else {
                  telegram.log(`[Binance][request] ${errorTypeText} ${status} ${statusText} Attempt: ${attempt}`);
                  await wait(attemptDelay);
                  // Try again this method with original not signed options
                  logger.warn('[Binance][request] Try again request to', rawUrl, `attempt #${attempt + 1}`);
                  try {
                    return fulfill(await this.request(rawUrl, origOptions, attempt + 1));
                  } catch (error) {
                    logger.error('[Binance][request] Client error attempts', error);
                    reject(error);
                  }
                }
              } else {
                logger.error('[Binance][request] Critical binance request error to', rawUrl, binanceCode, binanceMessage);
                if (binanceCode !== -2011) {
                  telegram.log(`[Binance][request] Critical binance request error to ${rawUrl}: (${binanceCode}) ${binanceMessage}`);
                }
                return reject(errorData);
              }
            } else {
              logger.error('[Binance][request] Rejected by unknown error', status, statusText);
              return reject(errorData);
            }
          }
        }
      })()
    })
  };
}

const binance = new Binance();

module.exports = {binance, Binance};
