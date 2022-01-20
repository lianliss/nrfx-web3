const logger = require('../utils/logger');
const _ = require('lodash');
const db = require('./db');
const web3Service = require('../services/web3');

class Wallet {
    constructor(data) {
        this.data = data;
    }
    data = {};

    save = async () => db.setUserWallet(this.data);
    static create = async userID => {
        try {
            const account = web3Service.createAccount();
            const data = {
                userID,
                address: account.address,
                privateData: web3Service.encryptPrivateKey(account.privateKey, userID),
                isGenerated: true,
                network: 'BEP20',
            };
            const wallet = new Wallet(data);
            await wallet.save();
            return wallet;
        } catch (error) {
            logger.error('[Wallet][create]', error);
            return;
        }
    };
    static importAddress = async (userID, address, network) => {
        const wallet = new Wallet({
            userID, address, network,
        });
        await wallet.save();
        return wallet;
    };

    getPrivateKey = () => {
        const {userID, privateData} = this.data;
        if (!userID || !privateData) return false;
        const account = web3Service.decryptPrivateKey(privateData, userID);
        if (account && account.privateKey) {
            return account.privateKey;
        } else {
            return false;
        }
    };

    getBalances = async () => {
        try {
            return await web3Service.getBalances(this.data.address);
        } catch (error) {
            logger.error('[Wallet][getBalances]', error);
            return {};
        }
    }
}

module.exports = Wallet;
