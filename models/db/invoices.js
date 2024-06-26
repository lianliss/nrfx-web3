const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

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
  name: {
    field: 'name',
    type: 'string',
  },
  lastName: {
    field: 'last_name',
    type: 'string',
  },
  phone: {
    field: 'phone',
    type: 'string',
  },
});

const addInvoice = async (amount, currency, accountAddress, phone, name, lastName, networkID = 'BSC') => {
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
            last_name,
            networkID
            )
            VALUES
            (
              ${Math.floor(Date.now() / 1000)},
              ${Math.floor(Date.now() / 1000)},
              0,
              ${amount},
              '${currency}',
              '${accountAddress}',
              'wait_for_pay',
              ${phone ? `'${phone}'` : 'NULL'},
              ${name ? `'${name}'` : 'NULL'},
              ${lastName ? `'${lastName}'` : 'NULL'},
              '${networkID}'
            );
        `);
    } catch (error) {
        logger.error('[addInvoice]', error);
        return null;
    }
};

const getActiveInvoice = async (accountAddress, currency = 'USD', networkID = 'BSC') => {
  try {
    return model.process(await db.query(`
            SELECT id, invoice_id, status, amount, currency, account_address, name, last_name, phone,
              created_at_timestamp, screenshot, networkID
            FROM fiat_invoices
            WHERE account_address = '${accountAddress}'
            AND currency = '${currency}'
            AND status = 'wait_for_pay'
            AND networkID = '${networkID}';
        `));
  } catch (error) {
    logger.error('[getInvoice]', error);
    return null;
  }
};

const getInvoice = async (accountAddress, currency = 'USD', networkID = 'BSC') => {
    try {
        return model.process(await db.query(`
            SELECT id, invoice_id, status, amount, currency, account_address, name, last_name, phone,
              created_at_timestamp, screenshot, networkID
            FROM fiat_invoices
            WHERE account_address = '${accountAddress}'
            AND currency = '${currency}'
            AND status IN ('wait_for_pay', 'wait_for_review')
            AND networkID = '${networkID}';
        `));
    } catch (error) {
        logger.error('[getInvoice]', error);
        return null;
    }
};

const getInvoiceById = async (id) => {
  try {
    return model.process(await db.query(`
            SELECT
              id, invoice_id, status, amount, currency, account_address, name, last_name, phone, screenshot,
              networkID
            FROM fiat_invoices
            WHERE id = ${id}
            AND status IN ('wait_for_pay', 'wait_for_review');
        `));
  } catch (error) {
    logger.error('[getInvoiceById]', error);
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
        return null;
    }
};

const addInvoiceScreenshot = async (id, filePath) => {
  try {
    return await db.query(`
            UPDATE fiat_invoices
            SET screenshot = '${filePath}'
            WHERE id = ${id};
        `);
  } catch (error) {
    logger.error('[addInvoiceScreenshot]', error);
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
        return null;
    }
};

module.exports = {
    addInvoice,
    getInvoice,
    getActiveInvoice,
    getInvoiceById,
    cancelInvoice,
    reviewInvoice,
    confirmInvoice,
    addInvoiceScreenshot,
};
