const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
  address: {
    type: 'string',
  },
  isKYCVerified: {
    field: 'isKYCVerified',
    type: 'boolean',
  },
  isValidator: {
    field: 'isValidator',
    type: 'boolean',
  },
  name: {
    field: 'name',
    type: 'string',
  },
  telegram: {
    field: 'telegram',
    type: 'number',
  },
});

const dataBaseName = 'p2p_accounts';

const setKYCVerified = async address => {
  try {
    const query = `
        INSERT INTO ${dataBaseName} (address, isKYCVerified)
        VALUES (
          '${address}',
          1
        )
        ON DUPLICATE KEY
        UPDATE
        isKYCVerified=1;`;
    return await db.query(query);
  } catch (error) {
    logger.error('[setKYCVerified]', error);
    return null;
  }
};

const setKYCName = async (address, name) => {
  try {
    const query = `
        INSERT INTO ${dataBaseName} (address, name)
        VALUES (
          '${address}',
          '${name}'
        )
        ON DUPLICATE KEY
        UPDATE
        name='${name}';`;
    return await db.query(query);
  } catch (error) {
    logger.error('[setKYCVerified]', error);
    return null;
  }
};

module.exports = {
  setKYCVerified,
  setKYCName,
};
