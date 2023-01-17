const _ = require('lodash');
const logger = require('../utils/logger');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;

const db = require('../models/db');
const telegram = require('../services/telegram');
const {rates} = require('../models/cache');

const getPDF = async (accountAddress, currency = 'USD', networkID = 'BSC') => {
  try {
    const invoice = (await db.getActiveInvoice(accountAddress, currency, networkID))[0];
    if (!invoice) throw new Error('No invoices for this account');

    const file = await fs.readFile('./views/invoice.pdf');
    const pdfDoc = await PDFDocument.load(file);
    const form = pdfDoc.getForm();

    const rate = await rates.get('idr');

    const date = new Date();
    const day = date.getDate();
    const year = date.getFullYear();
    let month = '';
    switch (date.getMonth() + 1) {
      case 1: month = 'January'; break;
      case 2: month = 'February'; break;
      case 3: month = 'March'; break;
      case 4: month = 'April'; break;
      case 5: month = 'May'; break;
      case 6: month = 'June'; break;
      case 7: month = 'July'; break;
      case 8: month = 'August'; break;
      case 9: month = 'September'; break;
      case 10: month = 'October'; break;
      case 11: month = 'November'; break;
      case 12:
      default: month = 'December';
    }

    const amount = Number(invoice.amount) || 0;
    const idrRate = amount / rate;
    const name = _.get(invoice, 'name', '');
    const lastName = _.get(invoice, 'lastName', '');

    form.getTextField('usdAmount').setText(amount.toFixed(2));
    form.getTextField('idrAmount').setText(idrRate.toFixed(2));
    form.getTextField('payerName').setText(`${name} ${lastName}`);
    form.getTextField('invoiceID').setText(invoice.id.toFixed(0));
    form.getTextField('date').setText(`${day} ${month} ${year}`);

    form.flatten();

    const bytes = await pdfDoc.save();
    const fileName = `tmp/invoice${invoice.id.toFixed(0)}.pdf`;
    await fs.writeFile(fileName, bytes);
    
    return fileName;
  } catch (error) {
    logger.error('[getPDF]', error);
    throw error;
  }
};

module.exports = {
  getPDF,
};
