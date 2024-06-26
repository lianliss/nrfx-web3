const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
  owner: {
    type: 'string',
  },
  address: {
    type: 'string',
  },
  side: {
    type: 'string',
  },
  network: {
    type: 'string',
  },
  currency: {
    type: 'string',
  },
  isActive: {
    type: 'boolean',
  },
  minTrade: {
    type: 'number',
  },
  maxTrade: {
    type: 'number',
  },
  isKYCRequired: {
    type: 'boolean',
  },
  commission: {
    type: 'number',
  },
  settings: {
    type: 'json',
  },
  created: {
    field: 'created_timestamp',
    type: 'number',
  },
  updated: {
    field: 'updated_timestamp',
    type: 'number',
  },
  schedule: {
    type: 'binary',
  },
  name: {
    type: 'string',
  },
});

const dataBaseName = 'p2p_offers';

const setOffer = async ({
                          offerAddress,
                          fiatAddress,
                          owner,
                          commission,
                          minTradeAmount,
                          maxTradeAmount,
                          isBuy,
                          networkID,
                        }) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const parts = model.getRequestParts({
      owner,
      address: offerAddress,
      side: isBuy ? 'buy' : 'sell',
      network: networkID,
      currency: fiatAddress,
      isActive: true,
      minTrade: minTradeAmount,
      maxTrade: maxTradeAmount,
      isKYCRequired: true,
      commission,
      settings: {},
      created: timestamp,
      updated: timestamp,
    });
    const query = `
        INSERT INTO ${dataBaseName} ${parts.fields}
        VALUES ${parts.values}
        ON DUPLICATE KEY
        UPDATE
        minTrade=${minTradeAmount},
        maxTrade=${maxTradeAmount},
        commission=${commission},
        updated_timestamp=${timestamp};`;
    return await db.query(query);
  } catch (error) {
    logger.error('[setOffer]', error);
    return null;
  }
};

const getOfferIsBuy = async offerAddress => {
  try {
    const result = await db.query(`
      SELECT side FROM ${dataBaseName} WHERE address = '${offerAddress}' LIMIT 1;
    `);
    return _.get(result[0], 'side', 'buy') === 'buy';
  } catch (error) {
    logger.error('[getOfferIsBuy]', error);
    return null;
  }
};

const setOfferActiveness = async (offerAddress, isActive) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    return await db.query(`
      UPDATE ${dataBaseName}
      SET
      isActive=${isActive ? 1 : 0},
      updated_timestamp=${timestamp}
      WHERE address = '${offerAddress}' LIMIT 1;
    `);
  } catch (error) {
    logger.error('[setOfferActiveness]', error);
    return null;
  }
};

const setOfferKYCRequired = async (offerAddress, isRequired) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    return await db.query(`
      UPDATE ${dataBaseName}
      SET
      isKYCRequired=${isRequired ? 1 : 0},
      updated_timestamp=${timestamp}
      WHERE address = '${offerAddress}' LIMIT 1;
    `);
  } catch (error) {
    logger.error('[setOfferKYCRequired]', error);
    return null;
  }
};

const getOfferSettings = async (offerAddress) => {
  try {
    const result = await db.query(`
      SELECT settings FROM ${dataBaseName} WHERE address = '${offerAddress}' LIMIT 1;
    `);
    return model.process(result)[0].settings;
  } catch (error) {
    logger.error('[getOfferSettings]', error);
    return null;
  }
};

const setOfferSettings = async (offerAddress, settings) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const parts = model.getRequestParts({
      settings,
      updated: timestamp,
    });
    return await db.query(`
      UPDATE ${dataBaseName}
      SET
      settings=${parts.encoded['settings']},
      updated_timestamp=${timestamp}
      WHERE address = '${offerAddress}' LIMIT 1;
    `);
  } catch (error) {
    logger.error('[setOfferSettings]', error);
    return null;
  }
};

const setOfferSchedule = async (offerAddress, schedule) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const parts = model.getRequestParts({
      schedule,
      updated: timestamp,
    });
    return await db.query(`
      UPDATE ${dataBaseName}
      SET
      schedule=${parts.encoded['schedule']},
      updated_timestamp=${timestamp}
      WHERE address = '${offerAddress}' LIMIT 1;
    `);
  } catch (error) {
    logger.error('[setOfferSchedule]', error);
    return null;
  }
};

const getOffer = async (offerAddress) => {
  try {
    const result = await db.query(`
      SELECT * FROM ${dataBaseName} WHERE address = '${offerAddress}' LIMIT 1;
    `);
    return model.process(result)[0];
  } catch (error) {
    logger.error('[getOffer]', error);
    return null;
  }
};

const getValidatorOffers = async (ownerAddress) => {
  try {
    const result = await db.query(`
      SELECT * FROM ${dataBaseName} WHERE owner = '${ownerAddress}';
    `);
    return model.process(result);
  } catch (error) {
    logger.error('[getValidatorOffers]', error);
    return [];
  }
};

const getOffers = async ({
                           currency, bank, side, networkID = 'BSCTest', amount, offerAddress,
                         }) => {
  try {
    let query = `
      SELECT
        o.id AS id,
        o.owner AS owner,
        o.address AS address,
        o.side AS side,
        o.network AS network,
        o.currency AS currency,
        o.isActive AS isActive,
        o.minTrade AS minTrade,
        o.maxTrade AS maxTrade,
        o.isKYCRequired AS isKYCRequired,
        o.commission AS commission,
        o.settings AS settings,
        o.schedule AS schedule,
        a.name AS name
      FROM ${dataBaseName} AS o
      INNER JOIN p2p_accounts AS a
      ON o.owner = a.address
    `;
    const conditions = [];
    if (currency) {
      conditions.push(`currency='${currency}'`);
    }
    if (offerAddress) {
      conditions.push(`address='${offerAddress}'`);
    }
    if (bank) {
      conditions.push(`settings LIKE '%"code": "${bank}"%'`);
    }
    if (side) {
      conditions.push(`side = '${side}'`);
    }
    if (amount) {
      conditions.push(`minTrade <= '${amount}'`);
      conditions.push(`maxTrade >= '${amount}'`);
    }
    if (conditions.length) {
      query += 'WHERE ' + conditions.join(' AND ');
    }
    query += ';';
    const result = await db.query(query);
    
    return model.process(result);
  } catch (error) {
    logger.error('[getOffers]', error);
    return [];
  }
};

module.exports = {
  setOffer,
  getOfferIsBuy,
  setOfferActiveness,
  setOfferKYCRequired,
  getOfferSettings,
  setOfferSettings,
  setOfferSchedule,
  getOffer,
  getValidatorOffers,
  getOffers,
};
