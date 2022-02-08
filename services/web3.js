const config = require('../config');
//const telegram = require('../services/telegram');
const _ = require('lodash');
const Web3 = require('web3');
const logger = require('../utils/logger');
const errors = require('../models/error');
const db = require('../models/db');

const getUserPrivateKeyPassword = userID => `${config.web3.seed}${userID}`;

class Web3Service {
    constructor(network = 'BEP20', privateData) {
        try {
            const {
                providerAddress,
                name,
                contracts,
                defaultToken,
                defaultAddress, // Sender address
            } = config.networks[network];
            this.web3 = new Web3(providerAddress);
            this.network = network;
            this.networkName = name;
            this.defaultToken = defaultToken;

            // Create contracts
            Object.keys(contracts).map(token => {
                const {name, address, abi} = contracts[token];
                this.contracts[token] = new this.web3.eth.Contract(abi, address, {
                    from: defaultAddress,
                });
                this.contracts[token].name = name;
            });
            // Init sender account
            if (privateData) {
                this.setDefaultAccount(privateData);
                logger.info('[Web3Service] Default account', this.defaultAccount.address);
            } else {
                db.getMasterKeys().then(rows => {
                    const last = _.last(rows);
                    const privateData = last.key;
                    this.setDefaultAccount(privateData);
                    logger.info('[Web3Service] Default account', this.defaultAccount.address);
                }).catch(error => {
                    logger.error('[Web3Service][getMasterKeys]', error);
                })
            }
        } catch (error) {
            logger.error('[WalletService]', error);
        }
    }
    web3 = null;
    contracts = {};
    networkName = '';

    setDefaultAccount = privateData => this.defaultAccount = this.decryptPrivateKey(privateData, 0);
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
    });
    getTokenContract = token => {
        try {
            const contract = this.contracts[token];
            if (!contract) throw new Error(`No contract for token ${token}`);
            return contract;
        } catch (error) {
            logger.error('[Web3Service][getContract]', this.networkName, token, error);
        }
    };
    estimateGas = (recipient, token, amount, from = this.defaultAccount.address) => {
        if (token === 'bnb') {
            return this.web3.eth.estimateGas({
                from,
                to: recipient,
                value: this.toWei(amount),
            })
        } else {
            return this.getTokenContract(token)
                .methods
                .transfer(recipient, this.toWei(amount))
                .estimateGas({from});
        }
    };
    fromWei = amount => this.web3.utils.fromWei(Number(amount).toString());
    toWei = amount => this.web3.utils.toWei(Number(amount).toFixed(18));
    fromGwei = amount => this.web3.utils.fromWei(Number(amount).toString(), 'Gwei');
    toGwei = amount => this.web3.utils.toWei(Number(amount).toFixed(18), 'Gwei');
    transfer = (
        recipient,
        token,
        amount,
        precalculatedGas,
        account = this.defaultAccount
    ) => new Promise((fulfill, reject) => {
        (async () => {
            try {
                const from = account.address;
                const amountWei = this.toWei(amount);

                const txData = {
                    from,
                };
                if (token === 'bnb') {
                    // Prepare transaction data for BNB
                    const gas = precalculatedGas || await this.estimateGas(recipient, token, amount, from);
                    Object.assign(txData, {
                        to: recipient,
                        gas,
                        value: amountWei,
                    });
                } else {
                    // Prepare transaction data from contract
                    const contract = this.getTokenContract(token);
                    const tx = contract.methods.transfer(recipient, amountWei);
                    const gas = precalculatedGas || await tx.estimateGas({from});
                    Object.assign(txData, {
                        to: contract._address,
                        gas,
                        data: tx.encodeABI(),
                    });
                }

                // Sign and send transaction
                account.signTransaction(txData).then(transaction => {
                    logger.debug('[transferFromDefault]', token, amount, 'transaction', txData);

                    this.web3.eth.sendSignedTransaction(
                        transaction.rawTransaction
                    ).on('transactionHash', hash => {
                        logger.debug('[transferFromDefault]', token, amount, 'transactionHash', hash);
                    }).on('receipt', receipt => {
                        //logger.debug('receipt', receipt);
                    }).on('confirmation', (confirmationNumber, receipt) => {
                        //logger.debug('confirmation', confirmationNumber, receipt);
                        if (confirmationNumber <= 1) {
                            fulfill({
                                token,
                                amount,
                            });
                        }
                    }).on('error', error => {
                        logger.error('sendTransaction error', error);
                        if (_.includes(error.message, 'insufficient funds for gas')) {
                            return reject(new errors.NoGasError());
                        }

                        reject(error);
                    });
                });
            } catch (error) {
                logger.error('[Web3Service][transferFromDefault]', this.networkName, token, amount, recipient, error);
                if (_.includes(error.message, 'subtraction overflow')) {
                    reject(new errors.MasterAccountEmptyError());
                } else {
                    reject(error);
                }
            }
        })();
    });
}

const web3Service = new Web3Service();

module.exports = web3Service;
