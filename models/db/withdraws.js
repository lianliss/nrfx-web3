const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
  id: {
    field: 'id',
    type: 'number',
  },
  userID: {
    field: 'user_id',
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
  approvedAt: {
    field: 'approved_at_timestamp',
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
  accountAddress: {
    field: 'account_address',
    type: 'string',
  },
  status: {
    field: 'status',
    type: 'number',
  },
  provider: {},
  adminID: {
    field: 'admin_id',
    type: 'number',
  },
  bank: {
    field: 'bank_code',
    type: 'string',
  },
  accountNumber: {
    field: 'account_number',
    type: 'string',
  },
  accountHolder: {
    field: 'account_holder_name',
    type: 'string',
  },
  phone: {
    field: 'phone',
    type: 'string',
  },
});

const addWithdraw = async ({
                             amount, currency, accountAddress, accountNumber, accountHolder, bank, adminID, provider = '',
                             phone,
                           }) => {
  try {
    return await db.query(`
            INSERT INTO withdrawals
            (
            created_at_timestamp,
            updated_at_timestamp,
            user_id,
            from_id,
            amount,
            currency,
            account_address,
            status,
            account_number,
            account_holder_name,
            bank_code,
            provider,
            admin_id,
            phone
            )
            VALUES
            (
              ${Math.floor(Date.now() / 1000)},
              ${Math.floor(Date.now() / 1000)},
              0,
              0,
              ${amount},
              '${currency}',
              '${accountAddress}',
              2,
              '${accountNumber}',
              '${accountHolder}',
              '${bank}',
              '${provider}',
              ${adminID},
              '${phone}'
            );
        `);
  } catch (error) {
    logger.error('[addWithdraw]', error);
    return null;
  }
};

const getWithdraw = async (accountAddress, currency) => {
  try {
    return model.process(await db.query(`
            SELECT *
            FROM withdrawals
            WHERE account_address = '${accountAddress}'
            AND status = 2
            AND currency = '${currency}'
            ORDER BY id DESC;
        `));
  } catch (error) {
    logger.error('[getWithdraw]', error);
    return null;
  }
};

const getWithdrawById = async id => {
  try {
    return model.process(await db.query(`
            SELECT *
            FROM withdrawals
            WHERE id = ${id}
            AND status = 2;
        `));
  } catch (error) {
    logger.error('[getWithdrawById]', error);
    return null;
  }
};

const cancelWithdraw = async id => {
  try {
    return await db.query(`
            UPDATE withdrawals
            SET status = 3
            WHERE id = ${id}
            AND status != 1;
        `);
  } catch (error) {
    logger.error('[cancelWithdraw]', error);
    return null;
  }
};

const confirmWithdraw = async id => {
  try {
    return await db.query(`
            UPDATE withdrawals
            SET status = 1,
                approved_at_timestamp = ${Math.floor(Date.now() / 1000)}
            WHERE id = ${id};
        `);
  } catch (error) {
    logger.error('[confirmWithdraw]', error);
    return null;
  }
};

module.exports = {
  addWithdraw,
  getWithdraw,
  getWithdrawById,
  cancelWithdraw,
  confirmWithdraw,
};
