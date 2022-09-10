const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
  messageID: {
    field: 'message_id',
    type: 'number',
  },
  chatID: {
    field: 'chat_id',
    type: 'number',
  },
  operationID: {
    field: 'operation_id',
    type: 'number',
  },
});

const getOperationMessages = async operationID => {
  try {
    const data = await db.query(`
            SELECT
            *
            FROM telegram_messages
            WHERE operation_id = ${operationID};
        `);
    return data.length
      ? model.process(data)
      : null;
  } catch (error) {
    logger.error('[getOperationMessages]', error);
    return null;
  }
};

const putOperationMessage = async (operationID, chatID, messageID) => {
  try {
    await db.query(`
            INSERT INTO telegram_messages
            (operation_id, chat_id, message_id)
            VALUES
            (${operationID}, ${chatID}, ${messageID});
        `);
    return true;
  } catch (error) {
    logger.error('[putOperationMessage]', error);
    return null;
  }
};

const getOperationAdminMessages = async operationID => {
  try {
    const data = await db.query(`
            SELECT
            telegram_messages.id,
            telegram_messages.chat_id,
            telegram_messages.message_id,
            telegram_messages.operation_id
            FROM telegram_messages
            INNER JOIN users
            ON telegram_messages.chat_id = users.telegram_id
            WHERE operation_id = ${operationID}
            AND users.roles LIKE '%admin%';
        `);
    return data.length
      ? model.process(data)
      : null;
  } catch (error) {
    logger.error('[getOperationAdminMessages]', error);
    return null;
  }
};

const deleteMessage = async id => {
  try {
    await db.query(`
            DELETE FROM telegram_messages
            WHERE id = ${id};
        `);
    return true;
  } catch (error) {
    logger.error('[deleteMessage]', error);
    return null;
  }
};

module.exports = {
  getOperationMessages,
  putOperationMessage,
  getOperationAdminMessages,
  deleteMessage,
};
