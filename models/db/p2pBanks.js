const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const dataBaseName = 'p2p_banks';

const model = new DataModel({
  code: {
    type: 'string',
  },
  title: {
    type: 'string',
  },
  currencies: {
    type: 'string',
  },
});

const getCurrencyBanks = async (currency) => {
  try {
    return await db.query(`
      SELECT * FROM ${dataBaseName} WHERE currencies LIKE '%${currency}%';
    `);
  } catch (error) {
    logger.error('[getCurrencyBanks]', error);
    return null;
  }
};


const getAllBanks = async () => {
  try {
    return await db.query(`
      SELECT * FROM ${dataBaseName};
    `);
  } catch (error) {
    logger.error('[getAllBanks]', error);
    return null;
  }
};

module.exports = {
  getCurrencyBanks,
  getAllBanks,
};
