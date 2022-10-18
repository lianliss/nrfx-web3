const _ = require('lodash');
const logger = require('../utils/logger');
const db = require('../models/db');
const errors = require('../models/error');
const xl = require('excel4node');

/**
 * Returns money transactions statistic
 * @param req
 * @param res
 */
const gettransactions = (req, res) => {
  (async () => {
    try {
      const {user} = res.locals;
      if (!user.isAdmin) throw new errors.PermissionDeniedError();
      
      // Get DB data
      const data = await Promise.all([
        db.getExchangeHistory()
      ]);
      
      // Create a book
      const wb = new xl.Workbook({
        defaultFont: {
          size: 12,
          name: 'Calibri',
        },
        author: 'Narfex',
      });
      
      const transactions = wb.addWorksheet('Transactions');
      transactions.cell(1, 1).string('Type');
      transactions.cell(1, 2).string('ID');
      transactions.cell(1, 3).string('Address');
      transactions.cell(1, 4).string('FromAmount');
      transactions.cell(1, 5).string('FromCurrency');
      transactions.cell(1, 6).string('ToAmout');
      transactions.cell(1, 7).string('ToCurrency');
      transactions.cell(1, 8).string('Fee');
      transactions.cell(1, 9).string('FeeCurrency');
      transactions.cell(1, 10).string('ReferReward');
      transactions.cell(1, 11).string('Date');
      transactions.cell(1, 12).string('Card');
      transactions.cell(1, 13).string('Holder');
      transactions.cell(1, 14).string('Bank');
      transactions.cell(1, 15).string('ManagerID');
      transactions.cell(1, 16).string('ManagerName');
      transactions.cell(1, 17).string('Link');
      
      data[0].map((row, index) => {
        const i = index + 2;
        transactions.cell(i, 1).string(row.type);
        transactions.cell(i, 2).number(row.request_id);
        transactions.cell(i, 3).string(row.account_address);
        transactions.cell(i, 4).number(row.source_amount);
        transactions.cell(i, 5).string(row.source_currency);
        transactions.cell(i, 6).number(row.target_amount);
        transactions.cell(i, 7).string(row.target_currency);
        transactions.cell(i, 8).number(row.commission);
        transactions.cell(i, 9).string(row.commission_currency);
        transactions.cell(i, 10).number(row.refer_reward);
        transactions.cell(i, 11).date(new Date(row.timestamp * 1000));
        transactions.cell(i, 12).string(row.card || '');
        transactions.cell(i, 13).string(row.holder || '');
        transactions.cell(i, 14).string(row.bank || '');
        transactions.cell(i, 15).number(row.manager_id || 0);
        transactions.cell(i, 16).string(`${row.manager_first || ''} ${row.manager_last || ''}`.trim());
        transactions.cell(i, 17).string(`https://bscscan.com/tx/${row.tx_hash}`);
      });
      
      wb.write(`Stats${Date.now()}.xlsx`, res);
    } catch (error) {
      logger.error('[statisticController][gettransactions]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};

module.exports = {
  gettransactions,
};
