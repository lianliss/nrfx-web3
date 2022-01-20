const config = require('../config');
//const telegram = require('../services/telegram');
const _ = require('lodash');
const Web3 = require('web3');
const logger = require('../utils/logger');

const getUserPrivateKeyPassword = userID => `${config.web3.seed}${userID}`;

class Web3Service {
    constructor(network = config.networks.BEP20) {
        try {
            const {
                providerAddress,
                name,
                contracts,
                defaultToken,
            } = network;
            this.web3 = new Web3(providerAddress);
            this.networkName = name;
            this.defaultToken = defaultToken;

            // Create contracts
            Object.keys(contracts).map(token => {
                const {name, address, abi} = contracts[token];
                this.contracts[token] = new this.web3.eth.Contract(abi, address);
                this.contracts[token].name = name;
            })
        } catch (error) {
            logger.error('[WalletService]', error);
        }
    }
    web3 = null;
    contracts = {};
    networkName = '';

    createAccount = (enthropy = this.web3.utils.randomHex(32)) => this.web3.eth.accounts.create(enthropy);
    getAccount = privateKey => this.web3.eth.accounts.privateKeyToAccount(privateKey);
    encryptPrivateKey = (privateKey, userID) => this.web3.eth.accounts.encrypt(
        privateKey,
        getUserPrivateKeyPassword(userID),
    );
    decryptPrivateKey = (privateData, userID) => this.web3.eth.accounts.decrypt(
        privateData,
        getUserPrivateKeyPassword(userID),
    );
    getDefaultBalance = async address => {
        try {
            return await this.web3.eth.getBalance(address);
        } catch (error) {
            logger.error('[Web3Service][getDefaultBalance]', this.networkName, error);
            return;
        }
    };
    getTokenBalance = async (address, token) => {
        try {
            const contract = this.contracts[token];
            const balance = await contract.methods.balanceOf(address).call();
            return balance;
        } catch (error) {
            logger.error('[Web3Service][getTokenBalance]', this.networkName, token, error);
            return;
        }
    };
    getBalances = address => new Promise((fulfill, reject) => {
        const tokens = [
            this.defaultToken,
            ...Object.keys(this.contracts),
        ];
        const promises = [
            this.getDefaultBalance(address),
            ...Object.keys(this.contracts)
                .map(token => this.getTokenBalance(address, token))
        ];
        Promise.all(promises)
            .then(balances => {
                const result = {};
                balances.map((balance, index) => {
                    if (balance) {
                        result[tokens[index]] = balance;
                    }
                });
                fulfill(result);
            }).catch(error => {
                logger.error('[Web3Service][getBalances]', this.networkName, error);
                reject(error);
            });
    })
}

const web3Service = new Web3Service();

module.exports = web3Service;
