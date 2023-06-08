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
  settings: {
    type: 'json',
  }
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

const getP2pUser = async (address) => {
  try {
    const result = await db.query(`
      SELECT * FROM ${dataBaseName} WHERE address = '${address}';
    `);
    return model.process(result)[0];
  } catch (error) {
    logger.error('[getP2pUser]', error);
    return null;
  }
};

const setP2pUserTelegram = async (address, telegram) => {
  try {
    const query = `
        INSERT INTO ${dataBaseName} (address, telegram)
        VALUES (
          '${address}',
          ${telegram}
        )
        ON DUPLICATE KEY
        UPDATE
        telegram=${telegram};`;
    return await db.query(query);
  } catch (error) {
    logger.error('[setP2pUserTelegram]', error);
    return null;
  }
};

const setP2pUserSettings = async (address, settings) => {
  try {
    const parts = model.getRequestParts({
      address,
      settings,
    });
    return await db.query(`
      INSERT INTO ${dataBaseName} (address, settings)
      VALUES (
        '${address}',
        ${parts.encoded['settings']}
      )
      ON DUPLICATE KEY
      UPDATE
      settings=${parts.encoded['settings']};
    `);
  } catch (error) {
    logger.error('[setP2pUserSettings]', error);
    return null;
  }
};

module.exports = {
  setKYCVerified,
  setKYCName,
  getP2pUser,
  setP2pUserTelegram,
  setP2pUserSettings,
};
