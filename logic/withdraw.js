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

const WITHDRAWAL_BANKS = {
  RUB: [
    {code: 'Tinkoff', title: 'Tinkoff'},
    {code: 'Sberbank', title: 'СберБанк'},
    {code: 'BankVTB', title: 'Банк ВТБ'},
    {code: 'Gazprombank', title: 'Газпромбанк'},
    {code: 'Alfabank', title: 'Альфа-Банк'},
    {code: 'Rosselkhoz', title: 'Россельхозбанк'},
    {code: 'Rosbank', title: 'Росбанк'},
    {code: 'MosCreditBank', title: 'Московский Кредитный Банк'},
    {code: 'Otkrytie', title: 'Банк "Открытие"'},
    {code: 'Sovkombank', title: 'Совкомбанк'},
    {code: 'Raiffaizen', title: 'Райффайзенбанк'},
  ]
};

const startWithdraw = async (props) => {
  const {
    accountAddress,
    amount,
    currency,
    accountNumber,
    accountHolder,
    bank,
  } = props;
  try {
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
      + `Amount ${amount.toFixed(2)} ${currency}`
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

const cancelWithdraw = async (withdraw, chat) => {
  const {
    accountAddress, id, currency, amount, accountHolder, accountNumber,
  } = withdraw;
  try {
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

    const messages = await db.getWithdrawMessages(withdraw.id);
    if (messages && messages.length) messages.map(async message => {
      try {
        telegram.telegram.editMessageText(
          message.chatID,
          message.messageID,
          undefined,
          (!!chat
            ? `<b>✖️ Withdraw cancelled #${withdraw.id} by `
            + `<a href="tg://user?id=${chat.id}">${chat.first_name || ''} ${chat.last_name || ''}</a></b>\n`
            : `<b>✖️ Withdraw cancelled #${withdraw.id}</b>\n`)
          + `<code>${withdraw.accountAddress}</code>\n`
          + `<b>Bank:</b> ${withdraw.bank.toUpperCase()}\n`
          + `<b>Account:</b> <code>${withdraw.accountNumber}</code>\n`
          + `<b>Holder name:</b> ${withdraw.accountHolder.toUpperCase()}\n`
          + `<b>Amount:</b> ${withdraw.amount.toFixed(2)} ${withdraw.currency.toUpperCase()}`,
          {
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          });
      } catch (error) {
        logger.error('[confirmWithdraw] editMessageText', error);
      }
    });

    return txHash;
  } catch (error) {
    logger.error('[cancelWithdraw]', withdraw.id, accountAddress, error);
    telegram.log(`[cancelWithdraw] Error #${withdraw.id} for ${accountAddress}: ${error.message}`);
    throw error;
  }
};
telegram.narfexLogic.cancelWithdraw = cancelWithdraw;

const confirmWithdraw = async (withdraw, chat) => {
  try {
    const data = await Promise.all([
      db.confirmWithdraw(withdraw.id),
      db.getWithdrawMessages(withdraw.id),
    ]);
    const messages = data[1];
    if (messages && messages.length) messages.map(async message => {
      try {
        telegram.telegram.editMessageText(
          message.chatID,
          message.messageID,
          undefined,
          (!!chat
            ? `<b>✅ Withdraw completed #${withdraw.id} by `
            + `<a href="tg://user?id=${chat.id}">${chat.first_name || ''} ${chat.last_name || ''}</a></b>\n`
            : `<b>✅ Withdraw completed #${withdraw.id}</b>\n`)
          + `<code>${withdraw.accountAddress}</code>\n`
          + `<b>Bank:</b> ${withdraw.bank.toUpperCase()}\n`
          + `<b>Account:</b> <code>${withdraw.accountNumber}</code>\n`
          + `<b>Holder name:</b> ${withdraw.accountHolder.toUpperCase()}\n`
          + `<b>Amount:</b> ${withdraw.amount.toFixed(2)} ${withdraw.currency.toUpperCase()}`,
          {
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          });
      } catch (error) {
        logger.error('[confirmWithdraw] editMessageText', error);
      }
    });
  } catch (error) {
    logger.error('[confirmWithdraw]', withdraw.id, withdraw.accountAddress, error);
    telegram.log(`[confirmWithdraw] Error #${withdraw.id} for ${withdraw.accountAddress}: ${error.message}`);
    throw error;
  }
};
telegram.narfexLogic.confirmWithdraw = confirmWithdraw;

module.exports = {
  startWithdraw,
  cancelWithdraw,
  confirmWithdraw,
  WITHDRAWAL_BANKS,
};
