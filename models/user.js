const logger = require('../utils/logger');
const _ = require('lodash');
const db = require('./db');
const cache = require('./cache');
const Wallet = require('./wallet');

class User {

  constructor(userData) {
    Object.assign(this, userData);

    this.roles = (_.get(userData, 'roles', '') || '').split(',');
    this.permissions = (_.get(userData, 'permissions', '') || '').split(',');

    this.isAdmin = _.includes(this.roles, 'admin');
    this.isManager = _.includes(this.roles, 'bank_cards_manager')
      || _.includes(this.permissions, 'bank_card_manage');
  }

  tokens = [];
  wallets = [];
  streams = [];
  isTransfersLocked = false; // Locks transfers while current transfer is in progress

  /**
   * Get user by token and appID
   * @param token {string} - Request header "x-token"
   * @param appID {number} - Request header "x-app-id"
   * @returns {Promise.<*>} - fulfill with User object
   */
  static getByAuth = async (token, appID) => {
    try {
      const tokenPair = `${appID}-${token}`;
      // Get user from cache by token
      const userCache = cache.usersByTokens[tokenPair];
      if (userCache) return userCache;

      // Get user from DB by token
      const userID = await db.getUserIDByAuth(token, appID);
      if (userID) {
        const user = await User.getByID(userID);
        if (user) {
          // Update tokens cache
          cache.usersByTokens[tokenPair] = user;
          if (user.telegramID) {
            cache.usersByTelegram[user.telegramID] = user;
          }
          user.tokens.push(tokenPair);
          return user;
        } else {
          return;
        }
      } else {
        return;
      }
    } catch (error) {
      logger.error('[User][getByAuth]', error);
      return;
    }
  };

  /**
   * Get user from DB and create user cache
   * @param userID {number}
   * @returns {Promise.<*>}
   */
  static getByID = async userID => {
    try {
      // Get user data from cache by ID
      const userCache = cache.users[userID];
      if (userCache) return userCache;

      // Get user data from DB
      const data = await Promise.all([
        db.getUserByID(userID),
        db.getSiteSettings(),
      ]);
      const userData = data[0];
      const settings = data[1];
      if (userData) {
        // Check refer percent value
        if (!_.isNumber(userData.referPercent)) {
          userData.referPercent = Number(settings.default_refer_percent) || 0;
        }

        // Get user from cache if it's already exists or create a new User object
        const user = !!cache.users[userID]
          ? cache.users[userID]
          : new User({
            userID,
            ...userData,
          });

        if (user.telegramID) {
          cache.usersByTelegram[user.telegramID] = user;
        }

        if (!cache.users[userID]) {
          await user.loadWallets();
        }
        // Update the cache
        cache.users[userID] = user;
        return user;
      } else {
        return;
      }
    } catch (error) {
      logger.error('[User][getByID]', error);
      return;
    }
  };

  /**
   * Get user from DB by telegramID and create user cache
   * @param telegramID {number}
   * @returns {Promise.<*>}
   */
  static getByTelegramID = async telegramID => {
    try {
      // Get user data from cache by ID
      const userCache = cache.usersByTelegram[telegramID];
      if (userCache) return userCache;

      // Get user data from DB
      const data = await Promise.all([
        db.getUserByTelegramID(telegramID),
        db.getSiteSettings(),
      ]);
      const userData = data[0];
      const settings = data[1];
      if (userData) {
        const userID = userData.id;
        // Check refer percent value
        if (!_.isNumber(userData.referPercent)) {
          userData.referPercent = Number(settings.default_refer_percent) || 0;
        }

        // Get user from cache if it's already exists or create a new User object
        const user = !!cache.users[userID]
          ? cache.users[userID]
          : new User({
            userID,
            ...userData,
          });

        if (!cache.users[userData.userID]) {
          await user.loadWallets();
        }
        // Update the cache
        cache.users[userID] = user;
        cache.usersByTelegram[telegramID] = user;
        return user;
      } else {
        return;
      }
    } catch (error) {
      logger.error('[User][getByID]', error);
      return;
    }
  };

  /**
   * Set a new telegramID for a user
   * @param telegramID {number}
   * @returns {Promise.<void>}
   */
  setTelegramID = async telegramID => {
    try {
      if (this.telegramID) {
        delete cache.usersByTelegram[this.telegramID];
        this.telegramID = null;
      }
      const result = await db.setUserTelegramID(this.userID, telegramID);
      this.telegramID = telegramID;
      cache.usersByTelegram[telegramID] = this;
      return result;
    } catch (error) {
      logger.error('[User][setTelegramID]', error);
      throw error;
    }
  };

  /**
   * Load all user wallets
   * @returns {Promise.<Array>}
   */
  loadWallets = async () => {
    try {
      const wallets = await db.getUserWallets(this.userID);
      this.wallets = wallets.map(data => new Wallet(data));
      return this.wallets;
    } catch (error) {
      logger.error('[loadWallets]', error);
      return [];
    }
  };

  /**
   * Create a new wallet in DB
   * @returns {Promise.<*>}
   */
  createWallet = async (network = 'BEP20') => {
    const wallet = await Wallet.create(this.userID, network);
    this.wallets.push(wallet);
    return wallet;
  };
  /**
   * Import external wallet address
   * @param address {string}
   * @param network {string}
   * @returns {Promise.<*>}
   */
  importWallet = async (address, network) => {
    const wallet = await Wallet.importAddress(this.userID, address, network);
    this.wallets.push(wallet);
    return wallet;
  };

  /**
   * Import wallet by private key as generated by us with full control
   * @param privateKey {string} - wallet private key
   * @param network {string} - wallet network (optional). Default: 'BEP20'
   * @returns {Promise.<Wallet>} - returns a new wallet object
   */
  importPrivateKey = async (privateKey, network) => {
    const wallet = await Wallet.importPrivateKey(this.userID, privateKey, network);
    this.wallets.push(wallet);
    return wallet;
  };

  /**
   * Get wallet object by address
   * @param address
   */
  getWallet = address => {
    return this.wallets.find(w => w.data.address === address)
  };

  deleteWallet = async address => {
    try {
      await db.deleteUserWallet(address, this.userID);
      await this.loadWallets();
    } catch (error) {
      logger.error('[User][deleteWallet]', this.login, this.userID, address);
    }
  };

  getFiats = () => db.getUserFiats(this.userID);
  decreaseFiatBalance = (fiat, amount) => db.decreaseUserFiatBalance(this.userID, fiat, amount);
  increaseFiatBalance = (fiat, amount) => db.increaseUserFiatBalance(this.userID, fiat, amount);

  /**
   * Send a message through a stream
   * @param message
   */
  send(message) {
    this.streams = this.streams.filter(stream => stream.connected);
    this.streams.map(stream => stream.sendUTF(message));
  }

  /**
   * Send an object through a stream
   * @param data
   */
  sendJson(data) {
    try {
      this.send(JSON.stringify(data));
    } catch (error) {
      logger.error('[User][sendJson] error', error);
    }
  }

}

module.exports = User;
