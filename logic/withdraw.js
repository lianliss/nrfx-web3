const _ = require('lodash');
const logger = require('../utils/logger');

const web3Service = require('../services/web3');
const db = require('../models/db');
const telegram = require('../services/telegram');
const {FIAT_FACTORY, ZERO_ADDRESS} = require('../const');
const wei = require('../utils/wei');
const userModel = require('../models/user');

const WITHDRAWAL_MANAGERS = {
  RUB: 3765, // Eugene Golikov
  UAH: 4279, // Danil Sakhinov
};

const startWithdraw = async (props) => {
  try {
    const {
      accountAddress,
      amount,
      currency,
      accountNumber,
      accountHolder,
      bank,
    } = props;

    // Check the manager is available
    const managerID = _.get(WITHDRAWAL_MANAGERS, currency.toUpperCase());
    const manager = await userModel.getByID(managerID);
    if (!managerID || !manager.telegramID) throw new Error('Withdrawal for this currency is not available');

    // Get fiat contract address from the factory
    const factoryContract = new (web3Service.web3.eth.Contract)(
      require('../const/ABI/fiatFactory'),
      FIAT_FACTORY,
    );
    const fiatAddress = await factoryContract.methods.fiats(currency.toUpperCase()).call();
    if (fiatAddress === ZERO_ADDRESS) throw new Error(`NarfexFiat for ${currency} is not deployed yet`);

    // Burn tokens from address
    const fiatContract = new (web3Service.web3.eth.Contract)(
      require('../const/ABI/fiat'),
      fiatAddress,
    );
    const receipt = await web3Service.transaction(fiatContract, 'burnFrom', [
      accountAddress,
      wei.to(amount),
    ]);
    const txHash = _.get(receipt, 'transactionHash');
    telegram.log(`[startWithdraw] Burn <code>${txHash}</code>\n`
      + `From <code>${accountAddress}</code>\n`
      + `For ${accountHolder} ${accountNumber}`);

    // Add to DB
    await db.addWithdraw({
      ...props,
      adminID: managerID,
    });
    const withdraw = (await db.getWithdraw(accountAddress, currency))[0];

    // Send to telegrams
    const admins = await db.getAdminsWithTelegram();
    admins.map(user => {
      telegram.sendWithdraw(user, withdraw);
    });
    return true;
  } catch (error) {
    logger.error('[startWithdraw]', accountAddress, amount, currency, error);
    telegram.log(`[startWithdraw] Error ${accountAddress} ${amount.toFixed(2)} ${currency}: ${error.message}`);
    throw error;
  }
};

const cancelWithdraw = async withdraw => {
  try {
    const {
      accountAddress, id, currency, amount, accountHolder, accountNumber,
    } = withdraw;

    // Get fiat contract address from the factory
    const factoryContract = new (web3Service.web3.eth.Contract)(
      require('../const/ABI/fiatFactory'),
      FIAT_FACTORY,
    );
    const fiatAddress = await factoryContract.methods.fiats(currency.toUpperCase()).call();
    if (fiatAddress === ZERO_ADDRESS) throw new Error(`NarfexFiat for ${currency} is not deployed yet`);

    // Mint tokens back to address
    const fiatContract = new (web3Service.web3.eth.Contract)(
      require('../const/ABI/fiat'),
      fiatAddress,
    );
    const receipt = await web3Service.transaction(fiatContract, 'mintTo', [
      accountAddress,
      wei.to(amount),
    ]);
    const txHash = _.get(receipt, 'transactionHash');
    telegram.log(`[cancelWithdraw] Mint back <code>${txHash}</code>\n`
      + `To <code>${accountAddress}</code>\n`
      + `For ${accountHolder} ${accountNumber}`);

    return txHash;
  } catch (error) {
    logger.error('[cancelWithdraw]', withdrawID, accountAddress, error);
    telegram.log(`[cancelWithdraw] Error #${withdrawID} for ${accountAddress}: ${error.message}`);
    throw error;
  }
};

module.exports = {
  startWithdraw,
  cancelWithdraw,
};
