const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');

const addReferAccount = async (referAddress, short) => {
  try {
    return await db.query(`
      INSERT INTO refer_accounts
      (refer_address, short)
      VALUES
      ('${referAddress}', '${short}');
    `);
  } catch (error) {
    logger.error('[addReferAccount]', error);
    return null;
  }
};

const getReferShort = async referAddress => {
  try {
    return await db.query(`
      SELECT short, id
      FROM refer_accounts
      WHERE refer_address = '${referAddress}';
    `);
  } catch (error) {
    logger.error('[getReferShort]', error);
    return [];
  }
};

const getReferByShort = async short => {
  try {
    return await db.query(`
      SELECT refer_address, id
      FROM refer_accounts
      WHERE short = '${short}';
    `);
  } catch (error) {
    logger.error('[getReferByShort]', error);
    return [];
  }
};

const addReferRelation = async (accountAddress, referID) => {
  try {
    return await db.query(`
      INSERT INTO refer_relations
      (account_address, refer_id)
      VALUES
      ('${accountAddress}', ${referID})
      ON DUPLICATE KEY
      UPDATE refer_id=VALUES(refer_id);
    `);
  } catch (error) {
    logger.error('[addReferRelation]', error);
    return null;
  }
};

const getReferRelation = async accountAddress => {
  try {
    return await db.query(`
      SELECT
      refer_address,
      refer_accounts.id as refer_id
      FROM refer_relations
      INNER JOIN refer_accounts
      ON refer_relations.refer_id = refer_accounts.id
      WHERE account_address = '${accountAddress}'
    `);
  } catch (error) {
    logger.error('[getReferRelation]', error);
    return [];
  }
};

const getReferInvites = async referID => {
  try {
    return await db.query(`
      SELECT
      account_address
      FROM refer_relations
      WHERE refer_id = ${referID};
    `);
  } catch (error) {
    logger.error('[getReferInvites]', error);
    return [];
  }
};

const addReferReward = async (referID, accountAddress, currency, amount) => {
  try {
    return await db.query(`
      INSERT INTO refer_rewards
      (refer_id, account_address, currency, amount, created_at_timestamp)
      VALUES
      (
      ${referID},
      '${accountAddress}',
      '${currency}',
      ${amount},
      ${Math.floor(Date.now() / 1000)}
      );
    `);
  } catch (error) {
    logger.error('[addReferReward]', error);
    return [];
  }
};

const getReferRewards = async referID => {
  try {
    return await db.query(`
      SELECT
      account_address,
      currency,
      SUM(amount) as 'amount'
      FROM refer_rewards
      WHERE refer_id = ${referID}
      GROUP BY account_address, currency;
    `);
  } catch (error) {
    logger.error('[getReferRewards]', error);
    return [];
  }
};

const getReferRewardsAfter = async (referID, timestamp) => {
  try {
    return await db.query(`
      SELECT
      account_address,
      currency,
      SUM(amount) as 'amount'
      FROM refer_rewards
      WHERE refer_id = ${referID}
      AND created_at_timestamp >= ${Math.floor(timestamp / 1000)}
      GROUP BY account_address;
    `);
  } catch (error) {
    logger.error('[getReferRewards]', error);
    return [];
  }
};


module.exports = {
  addReferAccount,
  getReferShort,
  getReferByShort,
  addReferRelation,
  getReferRelation,
  getReferInvites,
  addReferReward,
  getReferRewards,
  getReferRewardsAfter,
};
