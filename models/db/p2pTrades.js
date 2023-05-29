const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
  id: {
    type: 'number',
  },
  side: {
    type: 'string',
  },
  trader: {
    type: 'string',
  },
  offer: {
    type: 'string',
  },
  client: {
    type: 'string',
  },
  lawyer: {
    type: 'string',
  },
  network: {
    type: 'string',
  },
  currency: {
    type: 'string',
  },
  chat: {
    type: 'string',
  },
  status: {
    type: 'number',
  },
  moneyAmount: {
    type: 'number',
  },
  fiatAmount: {
    type: 'number',
  },
  isCancel: {
    type: 'boolean',
  },
  isPayed: {
    type: 'boolean',
  },
  created: {
    field: 'created_timestamp',
    type: 'number',
  },
  ownerName: {
    type: 'string',
  },
  clientName: {
    type: 'string',
  },
});

const dataBaseName = 'p2p_trades';

const setTrade = async ({
                          side,
                          trader,
                          offer,
                          client,
                          chat,
                          lawyer,
                          status,
                          currency,
                          moneyAmount,
                          fiatAmount,
                          networkID,
                          timestamp = Math.floor(Date.now() / 1000),
                        }) => {
  try {
    const parts = model.getRequestParts({
      side,
      trader,
      offer,
      client,
      chat,
      lawyer,
      status,
      currency,
      moneyAmount,
      fiatAmount,
      network: networkID,
      created: timestamp,
    });
    const query = `
        INSERT INTO ${dataBaseName} ${parts.fields}
        VALUES ${parts.values}
        ON DUPLICATE KEY
        UPDATE
        status=${status},
        lawyer='${lawyer}';`;
    return await db.query(query);
  } catch (error) {
    logger.error('[setTrade]', error);
    return null;
  }
};

const setTradeIsCancel = async ({
                          chat,
                        }) => {
  try {
    const query = `
        UPDATE ${dataBaseName}
        SET isCancel = 1
        WHERE chat = '${chat}'
        LIMIT 1;`;
    return await db.query(query);
  } catch (error) {
    logger.error('[setTradeIsCancel]', error);
    return null;
  }
};

const setTradeIsPayed = async ({
                                  chat,
                                }) => {
  try {
    const query = `
        UPDATE ${dataBaseName}
        SET isPayed = 1
        WHERE chat = '${chat}'
        LIMIT 1;`;
    return await db.query(query);
  } catch (error) {
    logger.error('[setTradeIsPayed]', error);
    return null;
  }
};

const getTrades = async ({
                           trader, client, networkID = 'BSCTest', status, lawyer, side, offer, chat,
                         }) => {
  try {
    let query = `
      SELECT
        o.id AS id,
        o.side AS side,
        o.trader AS trader,
        o.offer AS offer,
        o.client AS client,
        o.chat AS chat,
        o.lawyer AS lawyer,
        o.status AS status,
        o.currency AS currency,
        o.moneyAmount AS moneyAmount,
        o.fiatAmount AS fiatAmount,
        o.network AS network,
        o.created_timestamp AS created_timestamp,
        o.isCancel AS isCancel,
        o.isPayed AS isPayed,
        a.name AS ownerName,
        c.name AS clientName
      FROM ${dataBaseName} AS o
      INNER JOIN p2p_accounts AS a
      ON o.trader = a.address
      INNER JOIN p2p_accounts AS c
      ON o.client = c.address
    `;
    const conditions = [];
    if (trader) {
      conditions.push(`trader='${trader}'`);
    }
    if (client) {
      conditions.push(`client='${client}'`);
    }
    if (lawyer) {
      conditions.push(`client='${lawyer}'`);
    }
    if (offer) {
      conditions.push(`offer='${offer}'`);
    }
    if (status) {
      conditions.push(`status=${status}`);
    }
    if (side) {
      conditions.push(`side = '${side}'`);
    }
    if (chat) {
      conditions.push(`chat = '${chat}'`);
    }
    if (networkID) {
      conditions.push(`network = '${networkID}'`);
    }
    if (conditions.length) {
      query += 'WHERE ' + conditions.join(' AND ');
    }
    query += ';';
    const result = await db.query(query);
    
    return model.process(result);
  } catch (error) {
    logger.error('[getTrades]', error);
    return [];
  }
};

module.exports = {
  setTrade,
  getTrades,
  setTradeIsCancel,
  setTradeIsPayed,
};
