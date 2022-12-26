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
  UAH: 8679,
  IDR: 6287, // Kris
  TRY: 8679,
};

const WITHDRAW_LIMITS = {
  RUB: [5000, 150000],
  UAH: [1000, 50000],
  IDR: [500000, 150000000],
  CNY: [500, 750000],
  PLN: [500, 100000],
  THB: [500, 100000],
  CAD: [500, 10000],
  TRY: [500, 450000],
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
  ],
  UAH: [
    {code: 'Monobank', title: 'Монобанк'},
    {code: 'Raiffaizen', title: 'Райффайзен банк Аваль'},
    {code: 'CreditAgricole', title: 'Креді Агріколь Банк'},
    {code: 'Ukrsibbank', title: 'Ukrsibbank'},
    {code: 'PrivatBank', title: 'ПриватБанк'},
    {code: 'Oschadbank', title: 'Ощадбанк'},
    {code: 'Ukreksimbank', title: 'Укрексімбанк'},
    {code: 'Credobank', title: 'Кредобанк'},
    {code: 'Ukrgazbank', title: 'Укргазбанк'},
    {code: 'OTPBank', title: 'ОТП Банк'},
    {code: 'ProCreditBank', title: 'ПроКредит Банк'},
    {code: 'CitiBank', title: 'СІТІбанк Україна'},
    {code: 'INGBank', title: 'ІНГ Банк Україна'},
    {code: 'PravexBank', title: 'Правекс-банк'},
    {code: 'PUMB', title: 'ПУМБ'},
    {code: 'UniversalBank', title: 'Універсал Банк'},
  ],
  IDR: [
    {code: 'BCA', title: 'Bank Central Asia (BCA)'},
    {code: 'BankDBS', title: 'Bank DBS Indonesia'},
    {code: 'Mandiri', title: 'Bank Mandiri'},
    {code: 'OUB', title: 'United Overseas Bank'},
    {code: 'BankSyariah', title: 'Bank Syariah Indonesia'},
    {code: 'Citibank', title: 'Citibank'},
    {code: 'BankJago', title: 'Bank Jago'},
    {code: 'BCASyariah', title: 'BCA Syariah'},
    {code: 'HSBC', title: 'HSBC Holdings'},
    {code: 'Bank Negara Indonesia', title: 'Bank Negara Indonesia (BNI)'},
    {code: 'PaninBank', title: 'Panin Bank'},
    {code: 'BRI', title: 'BRI'},
    {code: 'BNC', title: 'Bank Neo Commerce (BNC)'},
    {code: 'Maybank', title: 'Maybank'},
    {code: 'DKI', title: 'Bank DKI'},
    {code: 'OCBCNISP', title: 'OCBC NISP'},
    {code: 'CIMBNiaga', title: 'CIMB Niaga'},
    {code: 'Permata', title: 'Bank Permata'},
    {code: 'Jenius', title: 'Jenius'},
    {code: 'BTPN', title: 'Bank Tabungan Pensiunan Nasional (BTPN)'},
  ],
  TRY: [
    {code: 'ZiraatBank', title: 'Ziraat Bank'},
    {code: 'Isbank', title: 'Isbank'},
    {code: 'GarantiBank', title: 'Garanti Bank'},
    {code: 'AKBank', title: 'AKBank'},
    {code: 'YapiKrediBank', title: 'Yapi Kredi Bank'},
    {code: 'Denizbank', title: 'Denizbank'},
    {code: 'Finansbank', title: 'Finansbank'},
    {code: 'Vakifbank', title: 'Vakifbank'},
    {code: 'Halkbank', title: 'Halkbank'},
    {code: 'TurkEkonomiBankasi', title: 'Türk Ekonomi Bankası'},
    {code: 'QNBFinansbank', title: 'QNB Finansbank'},
    {code: 'TurkishBank', title: 'Turkish Bank'},
    {code: 'ilbank', title: 'İlbank'},
    {code: 'Fibabanka', title: 'Fibabanka'},
    {code: 'Anadolubank', title: 'Anadolubank'},
    {code: 'TurkishEximbank', title: 'Turkish Eximbank'},
    {code: 'INGBankTurkey', title: 'ING Bank Turkey'},
    {code: 'HSBCBankTurkey', title: 'HSBC Bank Turkey'},
    {code: 'Sekerbank', title: 'Şekerbank'},
    {code: 'AlternatifBank', title: 'Alternatif Bank'},
  ],
};

Object.keys(WITHDRAWAL_BANKS).map(currency => {
  const limits = _.get(WITHDRAW_LIMITS, currency, [500, 100000]);
  WITHDRAWAL_BANKS[currency].map(bank => {
    bank.min = limits[0];
    bank.max = limits[1];
  })
});

const getBankTitle = (bank, currency) => {
  const bankRecord = _.get(WITHDRAWAL_BANKS, currency, [])
    .find(b => b.code === bank);
  return _.get(bankRecord, 'title', bank);
};

const startWithdraw = async (props) => {
  const {
    accountAddress,
    amount,
    currency,
    accountNumber,
    accountHolder,
    bank,
    phone,
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
    telegram.log(`Burn <code>${txHash}</code>\n`
      + `<b>Reason:</b> withdraw`
      + `<b>Amount:</b> ${amount.toFixed(2)} ${currency}\n`
      + `<b>From:</b> <code>${accountAddress}</code>\n`
      + `<b>For:</b> ${accountHolder} ${accountNumber}`);

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
    
    const history = {
      type: 'withdraw',
      requestID: withdraw.id,
      accountAddress,
      sourceCurrency: currency,
      targetCurrency: currency,
      commissionCurrency: currency,
      sourceAmount: amount,
      targetAmount: amount,
      commission: 0,
      txHash,
      isCompleted: false,
    };
    await db.addExchangeHistory(history);
    
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
    messages && telegram.updateMessages(
      messages,
      (!!chat
        ? `<b>✖️ Withdraw cancelled #${withdraw.id} by `
        + `<a href="tg://user?id=${chat.id}">${chat.first_name || ''} ${chat.last_name || ''}</a></b>\n`
        : `<b>✖️ Withdraw cancelled #${withdraw.id}</b>\n`)
      + `<code>${withdraw.accountAddress}</code>\n`
      + `<b>Amount:</b> ${withdraw.amount.toFixed(2)} ${withdraw.currency.toUpperCase()}\n`
      + `<b>Bank:</b> ${getBankTitle(withdraw.bank, withdraw.currency)}\n`
      + `<b>Account:</b> <code>${withdraw.accountNumber}</code>\n`
      + `<b>Holder name:</b> ${withdraw.accountHolder.toUpperCase()}\n`
      + `<b>Phone:</b> ${withdraw.phone}`,
      {
        links: [
          {title: 'View mint back', url: `https://bscscan.com/tx/${txHash}`}
        ]
      },
    );

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
      db.completeWithdrawHistory(withdraw.id),
    ]);
    const messages = data[1];
    messages && telegram.updateMessages(
      messages,
      (!!chat
        ? `<b>✅ Withdraw completed #${withdraw.id} by `
        + `<a href="tg://user?id=${chat.id}">${chat.first_name || ''} ${chat.last_name || ''}</a></b>\n`
        : `<b>✅ Withdraw completed #${withdraw.id}</b>\n`)
      + `<code>${withdraw.accountAddress}</code>\n`
      + `<b>Amount:</b> ${withdraw.amount.toFixed(2)} ${withdraw.currency.toUpperCase()}\n`
      + `<b>Bank:</b> ${getBankTitle(withdraw.bank, withdraw.currency)}\n`
      + `<b>Account:</b> <code>${withdraw.accountNumber}</code>\n`
      + `<b>Holder name:</b> ${withdraw.accountHolder.toUpperCase()}\n`
      + `<b>Phone:</b> ${withdraw.phone}`
    );
  } catch (error) {
    logger.error('[confirmWithdraw]', withdraw.id, withdraw.accountAddress, error);
    telegram.log(`[confirmWithdraw] Error #${withdraw.id} for ${withdraw.accountAddress}: ${error.message}`);
    throw error;
  }
};
telegram.narfexLogic.confirmWithdraw = confirmWithdraw;
telegram.narfexLogic.getBankTitle = getBankTitle;

module.exports = {
  startWithdraw,
  cancelWithdraw,
  confirmWithdraw,
  WITHDRAWAL_BANKS,
  WITHDRAW_LIMITS,
};
