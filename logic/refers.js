const _ = require('lodash');
const logger = require('../utils/logger');
const db = require('../models/db');
const Web3 = require('web3');

const getReferHash = async referAddress => {
  try {
    const hashes = await db.getReferShort(referAddress);
    if (hashes.length) {
      return _.last(hashes).short;
    } else {
      const web3 = new Web3();
      const hash = web3.utils.randomHex(4).split('x')[1];
      await db.addReferAccount(referAddress, hash);
      return hash;
    }
  } catch (error) {
    logger.error('[getReferHash]', error);
    return null;
  }
};

const getReferAddress = async hash => {
  try {
    return (await db.getReferByShort(hash))[0].refer_address;
  } catch (error) {
    logger.error('[getReferAddress]', error);
    return null;
  }
};

const getReferID = async hash => {
  try {
    return (await db.getReferByShort(hash))[0].id;
  } catch (error) {
    logger.error('[getReferID]', error);
    return null;
  }
};

const addAccountRefer = async (accountAddress, referHash) => {
  try {
    const refer = (await db.getReferByShort(referHash))[0];
    if (accountAddress === refer.refer_address) {
      return false;
    }
    await db.addReferRelation(accountAddress, refer.id);
    return true;
  } catch (error) {
    logger.error('[addAccountRefer]', error);
    return null;
  }
};

const getAccountRefer = async accountAddress => {
  try {
    const relation = await db.getReferRelation(accountAddress);
    if (relation.length) {
      return {
        id: relation[0].refer_id,
        address: relation[0].refer_address,
      }
    } else {
      return null;
    }
  } catch (error) {
    logger.error('[getAccountRefer]', error);
    return null;
  }
};

module.exports = {
  getReferHash,
  getReferAddress,
  addAccountRefer,
  getAccountRefer,
};
