const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');
const telegram = require('../../services/telegram');

const model = new DataModel({
    id: {
        field: 'id',
        type: 'number',
    },
    createdAt: {
        field: 'created_at_timestamp',
        type: 'number',
    },
    updatedAt: {
        field: 'updated_at_timestamp',
        type: 'number',
    },
    amount: {
        field: 'amount',
        type: 'number',
    },
    currency: {
        field: 'currency',
        type: 'string',
    },
    invoiceID: {
        field: 'invoice_id',
        type: 'string',
    },
    accountAddress: {
        field: 'account_address',
        type: 'string',
    },
    status: {
        field: 'status',
        type: 'string',
    },
});

const addInvoice = async (amount, currency, accountAddress, phone, name, lastName) => {
    try {
        return await db.query(`
            INSERT INTO fiat_invoices
            (
            created_at_timestamp,
            updated_at_timestamp,
            user_id,
            amount,
            currency,
            account_address,
            status,
            phone,
            name,
            last_name
            )
            VALUES
            (
              ${Math.floor(Date.now() / 1000)},
              ${Math.floor(Date.now() / 1000)},
              0,
              ${amount},
              '${currency}',
              '${accountAddress}',
              'wait_for_review',
              ${phone ? `'${phone}'` : 'NULL'},
              ${name ? `'${name}'` : 'NULL'},
              ${lastName ? `'${lastName}'` : 'NULL'}
            );
        `);
    } catch (error) {
        logger.error('[addInvoice]', error);
        telegram.log(`[addInvoice] ${error.message}`);
        return null;
    }
};

const getInvoice = async (accountAddress) => {
    try {
        return model.process(await db.query(`
            SELECT id, invoice_id, status, amount, currency
            FROM fiat_invoices
            WHERE account_address = '${accountAddress}'
            AND status IN ('wait_for_pay', 'wait_for_review');
        `));
    } catch (error) {
        logger.error('[getInvoice]', error);
        telegram.log(`[getInvoice] ${error.message}`);
        return null;
    }
};

const getInvoiceById = async (id) => {
  try {
    return model.process(await db.query(`
            SELECT id, invoice_id, status, amount, currency, account_address
            FROM fiat_invoices
            WHERE id = id
            AND status IN ('wait_for_pay', 'wait_for_review');
        `));
  } catch (error) {
    logger.error('[getInvoiceById]', error);
    telegram.log(`[getInvoiceById] ${error.message}`);
    return null;
  }
};

const cancelInvoice = async (id) => {
    try {
        return await db.query(`
            UPDATE fiat_invoices
            SET status = 'cancelled'
            WHERE id = ${id};
        `);
    } catch (error) {
        logger.error('[cancelInvoice]', error);
        telegram.log(`[cancelInvoice] ${error.message}`);
        return null;
    }
};

const reviewInvoice = async (id) => {
    try {
        return await db.query(`
            UPDATE fiat_invoices
            SET status = 'wait_for_review'
            WHERE id = ${id};
        `);
    } catch (error) {
        logger.error('[reviewInvoice]', error);
        telegram.log(`[reviewInvoice] ${error.message}`);
        return null;
    }
};

const confirmInvoice = async (id) => {
    try {
        return await db.query(`
            UPDATE fiat_invoices
            SET status = 'confirmed'
            WHERE id = ${id};
        `);
    } catch (error) {
        logger.error('[confirmInvoice]', error);
        telegram.log(`[confirmInvoice] ${error.message}`);
        return null;
    }
};

module.exports = {
    addInvoice,
    getInvoice,
    getInvoiceById,
    cancelInvoice,
    reviewInvoice,
    confirmInvoice,
};
