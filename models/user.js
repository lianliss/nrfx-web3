const logger = require('../utils/logger');
const _ = require('lodash');
const db = require('./db');
const cache = require('./cache');
const Wallet = require('./wallet');

class User {

    constructor(userData) {
        Object.assign(this, userData);
    }

    tokens = [];
    wallets = [];

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
            const userData = await db.getUserByID(userID);
            if (userData) {
                // Get user from cache if it's already exists or create a new User object
                const user = !!cache.users[userID]
                    ? cache.users[userID]
                    : new User({
                        userID,
                        ...userData,
                    });

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
    createWallet = async () => {
        const wallet = await Wallet.create(this.userID);
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
     * Get wallet object by address
     * @param address
     */
    getWallet = address => this.wallets.find(w => w.data.address === address);

    deleteWallet = async address => {
        try {
            await db.deleteUserWallet(address, this.userID);
            await this.loadWallets();
        } catch (error) {
            logger.error('[User][deleteWallet]', this.login, this.userID, address);
        }
    }

};

module.exports = User;
