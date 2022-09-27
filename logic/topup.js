const _ = require('lodash');
const logger = require('../utils/logger');

const web3Service = require('../services/web3');
const db = require('../models/db');
const telegram = require('../services/telegram');
const {FIAT_FACTORY, ZERO_ADDRESS} = require('../const');
const wei = require('../utils/wei');

const approveTopup = async (operationId, chat) => {
  try {
    // Get the operation data
    const operation = (await db.getReservationById(operationId))[0];
    logger.debug('[approveTopup] operation', operation);
    if (!operation) throw new Error(`No operation with ID = ${operationId}`);

    const {status, amount, fee, cardId, currency, bank} = operation;
    const accountAddress = _.get(operation, 'account_address');
    if (status !== 'wait_for_review'
      && status !== 'wait_for_admin_review') throw new Error('Operation is not in review');
    if (!accountAddress) throw new Error('Account address is undefined');

    const tokenAmount = amount - fee;

    // Get fiat contract address from the factory
    const factoryContract = new (web3Service.web3.eth.Contract)(
      require('../const/ABI/fiatFactory'),
      FIAT_FACTORY,
    );
    const fiatAddress = await factoryContract.methods.fiats(currency.toUpperCase()).call();
    logger.debug('[approveTopup] fiatAddress', currency, fiatAddress);
    if (fiatAddress === ZERO_ADDRESS) throw new Error(`NarfexFiat for ${currency} is not deployed yet`);

    // Mint tokens to address
    const fiatContract = new (web3Service.web3.eth.Contract)(
      require('../const/ABI/fiat'),
      fiatAddress,
    );
    const receipt = await web3Service.transaction(fiatContract, 'mintTo', [
      accountAddress,
      wei.to(tokenAmount),
    ]);
    const txHash = _.get(receipt, 'transactionHash');

    // Mark operation as confirmed
    const data = await Promise.all([
      db.approveReservation(operationId),
      db.cancelCardReservation(cardId),
      db.getOperationMessages(operation.id),
    ]);

    const messages = data[2];
    messages && telegram.updateMessages(
      messages,
      (!!chat
        ? `<b>✅ Topup #${operation.id} approved by `
        + `<a href="tg://user?id=${chat.id}">${chat.first_name || ''} ${chat.last_name || ''}</a></b>\n`
        : `<b>✅ Topup #${operation.id} approved</b>\n`)
      + `<code>${operation.account_address}</code>\n`
      + `<b>Card:</b> ${operation.number}\n<b>Holder:</b> ${operation.holder_name}\n<b>Manager: </b>`
      + (operation.telegram_id
      ? `<a href="tg://user?id=${operation.telegram_id}">${operation.first_name || ''} ${operation.last_name || ''}</a>`
      : `${operation.first_name || ''} ${operation.last_name || ''}`)
      + `\n<b>Amount:</b> ${operation.amount} ${operation.currency}\n`,
      {
        links: [
          {title: 'View mint transaction', url: `https://bscscan.com/tx/${txHash}`}
        ]
      },
    );

    return receipt;
  } catch (error) {
    logger.error('[approveTopup]', error);
    throw error;
  }
};
telegram.narfexLogic.approveTopup = approveTopup;

const approveInvoice = async (id, amount, chat) => {
    try {
        // Get the operation data
        const invoice = (await db.getInvoiceById(id))[0];
        logger.debug('[approveInvoice] invoice', invoice);
        if (!invoice) throw new Error(`No invoice with ID = ${id}`);

        const {status, currency} = invoice;
        const accountAddress = _.get(invoice, 'accountAddress');
        if (status !== 'wait_for_review'
            && status !== 'wait_for_pay') throw new Error('Invoice is not in review');
        if (!accountAddress) throw new Error('Account address is undefined');

        const tokenAmount = amount;

        // Get fiat contract address from the factory
        const factoryContract = new (web3Service.web3.eth.Contract)(
            require('../const/ABI/fiatFactory'),
            FIAT_FACTORY,
        );
        const fiatAddress = await factoryContract.methods.fiats(currency.toUpperCase()).call();
        logger.debug('[approveInvoice] fiatAddress', currency, fiatAddress);
        if (fiatAddress === ZERO_ADDRESS) throw new Error(`NarfexFiat for ${currency} is not deployed yet`);

        // Mint tokens to address
        const fiatContract = new (web3Service.web3.eth.Contract)(
            require('../const/ABI/fiat'),
            fiatAddress,
        );
        const receipt = await web3Service.transaction(fiatContract, 'mintTo', [
            accountAddress,
            wei.to(tokenAmount),
        ]);
        const txHash = _.get(receipt, 'transactionHash');

        // Mark operation as confirmed
        const data = await Promise.all([
          db.confirmInvoice(id),
          db.getInvoiceMessages(id),
        ]);

      const messages = data[1];
      messages && telegram.updateMessages(
        messages,
        (!!chat
          ? `<b>✅ SWIFT invoice #${invoice.id} approved by `
          + `<a href="tg://user?id=${chat.id}">${chat.first_name || ''} ${chat.last_name || ''}</a></b>\n`
          : `<b>✅ SWIFT invoice #${invoice.id} approved</b>\n`)
        + `<code>${invoice.accountAddress}</code>\n`
        + `<b>Buyer:</b> ${invoice.name || ''} ${invoice.lastName || ''}\n`
        + `<b>Phone:</b> ${invoice.phone || ''}\n`
        + `<b>Amount:</b> ${invoice.amount} ${invoice.currency}\n`,
        {
          links: [
            {title: 'View mint transaction', url: `https://bscscan.com/tx/${txHash}`}
          ]
        },
      );

        return receipt;
    } catch (error) {
        logger.error('[approveInvoice]', error);
        throw error;
    }
};
telegram.narfexLogic.approveInvoice = approveInvoice;

module.exports = {
  approveTopup,
  approveInvoice,
};
