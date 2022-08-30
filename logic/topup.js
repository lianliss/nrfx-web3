const _ = require('lodash');
const logger = require('../utils/logger');

const web3Service = require('../services/web3');
const db = require('../models/db');
const telegram = require('../services/telegram');
const {FIAT_FACTORY, ZERO_ADDRESS} = require('../const');
const wei = require('../utils/wei');

const approveTopup = async (operationId, isSwift = false, _amount) => {
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

    // Mark operation as confirmed
    await Promise.all([
      db.approveReservation(operationId),
      db.cancelCardReservation(cardId),
    ]);

    telegram.log(`[approveTopup] Confirmed operation #${operationId}: ${tokenAmount} ${currency} to ${accountAddress}`);

    return receipt;
  } catch (error) {
    logger.error('[approveTopup]', error);
    throw error;
  }
};

const approveInvoice = async (id, amount) => {
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

        // Mark operation as confirmed
        await db.confirmInvoice(id);

        telegram.log(`[approveInvoice] Confirmed invoice #${id}: ${tokenAmount} ${currency} to ${accountAddress}`);

        return receipt;
    } catch (error) {
        logger.error('[approveInvoice]', error);
        throw error;
    }
};

module.exports = {
  approveTopup,
  approveInvoice,
};
