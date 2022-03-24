const config = require('../config');
//const telegram = require('../services/telegram');
const _ = require('lodash');
const TonWeb = require('tonweb');
const logger = require('../utils/logger');
const errors = require('../models/error');
const db = require('../models/db');
const tonMnemonic = require('tonweb-mnemonic');
const CryptoJS = require('crypto-js');

const getUserPrivateKeyPassword = userID => `${config.web3.seed}${userID}`;
const {TON} = config.networks;

class TonService {
    constructor(encryption) {
        try {
            this.network = 'TON';
            this.tonweb = new TonWeb(
                new TonWeb.HttpProvider(
                    TON.providerAddress,
                    {apiKey: TON.apiKey},
                    )
            );

            this.defaultAccount = this.tonweb.wallet.create({
                address: TON.defaultAccount,
            });

            // Init sender account
            if (encryption) {
                this.setDefaultAccount(encryption).then(() => {
                    logger.info('[TonService] Default account', this.defaultAccount.address);
                });
            } else {
                db.getMasterKeys().then(rows => {
                    const record = rows.find(row => row.name === this.network);
                    const key = record.encryption || record.key;
                    this.setDefaultAccount(key).then(() => {
                        logger.info('[TonService] Default account', this.defaultAccount.address);
                    });
                }).catch(error => {
                    logger.error('[TonService][getMasterKeys]', error);
                })
            }
        } catch (error) {
            logger.error('[TonService]', error);
        }
    }

    /**
     * Set account as default market account
     * @param privateData {object} - encrypted privateKey data
     */
    setDefaultAccount = async encryption => {
        const mnemonic = this.decrypt(encryption, 0);
        this.defaultAccount = await this.getAccount(mnemonic);
    };

    fromNano = value => this.tonweb.utils.fromNano(value);
    toNano = value => this.tonweb.utils.toNano(value);

    createAccount = async () => {
        const mnemonic = await tonMnemonic.generateMnemonic();
        return await this.getAccount(mnemonic);
    };

    /**
     * Encrypt mnemonic words
     * @param mnemonic
     * @param userID
     */
    encrypt = (mnemonic, userID) => CryptoJS.AES.encrypt(
        mnemonic.join(' '),
        getUserPrivateKeyPassword(userID),
    ).toString();

    /**
     * Decrypt privateData to mnemonic words
     * @param privateData
     * @param userID
     */
    decrypt = (privateData, userID) => CryptoJS.AES.decrypt(
        privateData,
        getUserPrivateKeyPassword(userID),
    ).toString(CryptoJS.enc.Utf8).split(' ');

    /**
     * Get account data from mnemonic phrases
     * @param mnemonic {Array} - mnemonic words
     * @returns {Promise.<{address: string, mnemonic: *, keyPair: KeyPair, wallet: (Object|Promise.<*>)}>}
     */
    getAccount = async mnemonic => {
        const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic);
        const wallet = this.tonweb.wallet.create({
            publicKey: keyPair.publicKey,
            wc: 0,
        });
        const walletAddress = await wallet.getAddress();
        const address = walletAddress.toString(true, true, false);

        return {
            address,
            mnemonic,
            keyPair,
            wallet,
        }
    };

    /**
     * Get an amount of tokens of default currency in current blockchain
     * @param address {string} - wallet account data
     * @returns {Promise.<*>}
     */
    getDefaultBalance = async address => {
        try {
            return await this.tonweb.getBalance(address);
        } catch (error) {
            logger.error('[TonService][getDefaultBalance]', error);
            return;
        }
    };

    /**
     * Get all balances TODO: add smart contracts
     * @param address
     * @returns {Promise.<{}>}
     */
    getBalances = async address => {
        const balances = {};
        balances[TON.defaultToken] = await this.getDefaultBalance(address);

        return balances;
    };

    /**
     * Returns default market account balance
     */
    getDefaultAccountBalances = () => this.getBalances(this.defaultAccount.address);
    
}

const tonService = new TonService();

module.exports = tonService;
