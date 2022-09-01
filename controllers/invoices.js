const _ = require('lodash');
const logger = require('../utils/logger');
const cache = require('../models/cache');
const db = require('../models/db');
const errors = require('../models/error');
const web3Service = require('../services/web3');
const topupLogic = require('../logic/topup');
const telegram = require('../services/telegram');
const topupMethods = require('../const/topupMethods');
const invoiceLogic = require('../logic/invoice');
const fs = require('fs');

const addInvoice = (req, res) => {
    (async () => {
        try {
            const {accountAddress} = res.locals;
            const amount = Number(_.get(req, 'query.amount', 0));
            const currency = _.get(req, 'query.currency', undefined);
            const phone = _.get(req, 'query.phone');
            const name = _.get(req, 'query.name');
            const lastName = _.get(req, 'query.lastName');


            const result = await db.addInvoice(amount, currency, accountAddress, phone, name, lastName);

            res.status(200).json(result[0]);
        } catch (error) {
            logger.error('[invoiceController][addInvoice]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const getInvoice = (req, res) => {
    (async () => {
        try {
            const {accountAddress} = res.locals;
            const result = await db.getInvoice(accountAddress);

            res.status(200).json(result[0]);
        } catch (error) {
            logger.error('[invoiceController][getInvoice]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const cancelInvoice = (req, res) => {
    (async () => {
        try {
            const {accountAddress} = res.locals;
            const invoices = await db.getInvoice(accountAddress);
            if (!invoices.length) throw new Error('No invoices for this address');

            const result = await db.cancelInvoice(invoices[0].id);

            res.status(200).json(result[0]);
        } catch (error) {
            logger.error('[invoiceController][cancelInvoice]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const reviewInvoice = (req, res) => {
    (async () => {
        try {
            const {accountAddress} = res.locals;
            const invoices = await db.getInvoice(accountAddress);
            if (!invoices.length) throw new Error('No invoices for this address');
            const invoice = invoices[0];
            if (invoice.status !== 'wait_for_pay' && invoice.status !== 'wait_for_review') {
                throw new Error('Invoice is unavailable');
            }

            const result = await db.reviewInvoice(invoice.id);

            res.status(200).json(result[0]);
        } catch (error) {
            logger.error('[invoiceController][reviewInvoice]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const confirmInvoice = (req, res) => {
    (async () => {
        try {
            const id = Number(_.get(req, 'query.id'));
            const amount = Number(_.get(req, 'query.amount'));

            const receipt = await topupLogic.approveInvoice(id, amount);

            res.status(200).json(receipt);
        } catch (error) {
            logger.error('[invoiceController][confirmInvoice]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

const getPDF = (req, res) => {
  (async () => {
    try {
      const {accountAddress} = res.locals;
      const data = await invoiceLogic.getPDF(accountAddress);

      const fileContents  = Buffer.from(data, 'binary');
      const savedFilePath = `/temp/invoice${Date.now()}.pdf`;
      fs.writeFile(savedFilePath, fileContents, function() {
        res.status(200).download(savedFilePath, 'invoice.pdf');
      });
      // res.writeHead(200, {
      //   'Content-Type': 'application/pdf',
      //   'Content-disposition': 'attachment;filename=' + 'invoice.pdf',
      //   'Content-Length': data.length
      // });
      // res.end(Buffer.from(data, 'binary'));
    } catch (error) {
      logger.error('[invoiceController][getPDF]', error);
      res.status(500).json({
        name: error.name,
        message: error.message,
      });
    }
  })();
};



module.exports = {
    addInvoice,
    getInvoice,
    cancelInvoice,
    reviewInvoice,
    confirmInvoice,
  getPDF,
};
