const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const dataBaseName = 'btc_nrfx';

const addNRFXBTCExchange = async ({
  address,
  currency,
  fromAmount,
  toAmount,
  btcAddress,
  tx,
  networkID,
                                  }) => {
  try {
    const query = `
        INSERT INTO ${dataBaseName}
          (address,
          currency,
          fromAmount,
          toAmount,
          btcAddress,
          tx,
          networkID)
        VALUES (
          '${address}',
          '${currency}',
          ${fromAmount},
          ${toAmount},
          '${btcAddress}',
          '${tx}',
          '${networkID}'
        );`;
    return await db.query(query);
  } catch (error) {
    logger.error('[addNRFXBTCExchange]', error);
    return null;
  }
};

module.exports = {
  addNRFXBTCExchange,
};
