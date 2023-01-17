const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
    cardId: {
      field: 'id',
      type: 'number',
    },
    expiresAt: {
        field: 'book_expiration',
        type: 'number',
    },
    bookedBy: {
        field: 'booked_by',
        type: 'number',
    },
    isActive: {
        field: 'active',
        type: 'boolean',
    },
    isDeleted: {
        field: 'deleted_at',
        type: 'boolean',
    },
});

const getExpiredBookingCards = async () => {
    try {
        return model.process(await db.query(`
            SELECT id, book_expiration, booked_by
            FROM bank_cards
            WHERE book_expiration < ${Math.floor(Date.now() / 1000)}
            AND booked_by IS NOT NULL;
        `));
    } catch (error) {
        logger.error('[getExpiredBookingCards]', error);
        return null;
    }
};

const clearCardBookingByID = async id => {
    try {
        return db.query(`
        UPDATE bank_cards
        SET book_expiration = NULL, booked_by = NULL
        WHERE id = ${id};
        `);
    } catch (error) {
        logger.error('[clearCardBookingByID]', error);
        return null;
    }
};

const getExpiredReservations = async () => {
    try {
        return await db.query(`
            SELECT cards.id, cards.booked_by, cards.book_expiration,
            ops.id AS operation_id,
            ops.status, ops.amount,
            ops.created_at_timestamp
            FROM bank_cards AS cards
            INNER JOIN bank_cards_operations AS ops
            ON cards.id = ops.card_id
            WHERE cards.book_expiration < ${Math.floor(Date.now() / 1000)}
            AND ops.status = 'wait_for_pay'
            AND cards.booked_by IS NOT NULL;
        `);
    } catch (error) {
        logger.error('[getExpiredReservations]', error);
        return null;
    }
};

/**
 * Returns cards that do not have a user reservation (booked_by === NULL),
 * but for some reason a record of the end of the reservation remains (book_expiration !== NULL)
 * @returns {Promise.<*>}
 */
const getUnbookedCardsWithExpirations = async () => {
  try {
    return await db.query(`
            SELECT id
            FROM bank_cards
            WHERE book_expiration IS NOT NULL
            AND booked_by IS NULL;
        `);
  } catch (error) {
    logger.error('[getUnbookedCardsWithExpirations]', error);
    return null;
  }
};

const addCardReservationByWallet = async (cardId, accountAddress, amount, fee, networkID = 'BSC') => {
  try {
    return await db.query(`
            INSERT INTO bank_cards_operations
            (
            card_id, user_id, account_address, operation, amount, status,
            created_at_timestamp, updated_at_timestamp, fee, networkID
            )
            VALUES
            (
              ${cardId}, 0, '${accountAddress}', 'book', ${amount}, 'wait_for_pay',
              ${Math.floor(Date.now() / 1000)}, ${Math.floor(Date.now() / 1000)}, ${fee},
              '${networkID}'
            );
        `);
  } catch (error) {
    logger.error('[addCardReservationByWallet]', error);
    return null;
  }
};

const reserveTheCard = async (cardId, expiration) => {
  try {
    return await db.query(`
            UPDATE bank_cards
            SET book_expiration = ${expiration}, booked_by = 0
            WHERE id = ${cardId};
        `);
  } catch (error) {
    logger.error('[reserveTheCard]', error);
    return null;
  }
};

const getAvailableCards = async (currency, bank) => {
  try {
    return model.process(await db.query(`
            SELECT id
            FROM bank_cards
            WHERE booked_by IS NULL
            AND bank = '${bank}'
            AND book_expiration IS NULL
            AND active = 1
            AND deleted_at IS NULL
            AND currency = '${currency}'
            ORDER BY updated_at_timestamp ASC;
        `));
  } catch (error) {
    logger.error('[getAvailableCards]', error);
    return null;
  }
};

const getWalletReservation = async (accountAddress, currency, networkID = 'BSC') => {
  try {
    return await db.query(`
            SELECT
            ops.id AS operation_id,
            cards.book_expiration,
            cards.bank,
            cards.is_card,
            cards.number,
            cards.account_type,
            cards.routing_number,
            cards.account_address as address,
            cards.holder_name,
            cards.iban,
            cards.bic,
            cards.short_code,
            cards.institution_number,
            cards.transit_number,
            ops.status, ops.amount,
            ops.fee,
            ops.networkID
            FROM bank_cards AS cards
            INNER JOIN bank_cards_operations AS ops
            ON cards.id = ops.card_id
            WHERE cards.book_expiration > ${Date.now() / 1000}
            AND cards.booked_by IS NOT NULL
            AND ops.account_address = '${accountAddress}'
            AND cards.currency = '${currency}'
            AND ops.networkID = '${networkID}'
            AND (
              ops.status = 'wait_for_pay'
              OR ops.status = 'wait_for_review'
              OR ops.status = 'wait_for_admin_review'
            );
        `);
  } catch (error) {
    logger.error('[getWalletReservation]', error);
    return null;
  }
};

const cancelCardReservation = async (cardId) => {
  try {
    return await db.query(`
            UPDATE bank_cards
            SET book_expiration = NULL, booked_by = NULL,
            updated_at_timestamp = ${Math.floor(Date.now() / 1000)}
            WHERE id = ${cardId};
        `);
  } catch (error) {
    logger.error('[cancelCardReservation]', error);
    return null;
  }
};

const cancelBooking = async (id) => {
  try {
    return await db.query(`
            UPDATE bank_cards_operations
            SET status = 'cancelled',
            updated_at_timestamp = ${Math.floor(Date.now() / 1000)}
            WHERE id = ${id};
        `);
  } catch (error) {
    logger.error('[cancelBooking]', error);
    return null;
  }
};

const sendToReview = async (operationId, accountAddress) => {
  try {
    return await db.query(`
            UPDATE bank_cards_operations
            SET status = 'wait_for_review'
            WHERE id = ${operationId} AND account_address = '${accountAddress}';
        `);
  } catch (error) {
    logger.error('[sendToReview]', error);
    return null;
  }
};

const sendToAdminReview = async (operationId, accountAddress) => {
  try {
    return await db.query(`
            UPDATE bank_cards_operations
            SET status = 'wait_for_admin_review'
            WHERE id = ${operationId} AND account_address = '${accountAddress}';
        `);
  } catch (error) {
    logger.error('[sendToAdminReview]', error);
    return null;
  }
};

const approveReservation = async (operationId) => {
  try {
    return await db.query(`
            UPDATE bank_cards_operations
            SET status = 'confirmed'
            WHERE id = ${operationId};
        `);
  } catch (error) {
    logger.error('[approveReservation]', error);
    return null;
  }
};

const getReservationById = async (operationId) => {
  try {
    return await db.query(`
            SELECT
            ops.id,
            ops.account_address,
            ops.status, ops.amount,
            ops.fee,
            ops.networkID,
            cards.is_card,
            cards.number,
            cards.holder_name,
            cards.routing_number,
            cards.account_type,
            cards.account_address as address,
            cards.id as cardId,
            cards.managed_by,
            cards.currency,
            cards.bank,
            cards.iban,
            cards.bic,
            cards.short_code,
            cards.institution_number,
            cards.transit_number,
            users.first_name,
            users.last_name,
            users.telegram_id
            FROM bank_cards AS cards
            INNER JOIN bank_cards_operations AS ops
            ON cards.id = ops.card_id
            INNER JOIN users
            ON cards.managed_by = users.id
            WHERE ops.id = ${operationId};
        `);
  } catch (error) {
    logger.error('[getReservationById]', error);
    return null;
  }
};

const getAvailableBanks = async () => {
  try {
    return await db.query(`
            SELECT bank, currency
            FROM bank_cards
            WHERE booked_by IS NULL
            AND active = 1
            AND deleted_at IS NULL;
        `);
  } catch (error) {
    logger.error('[getAvailableBanks]', error);
    return null;
  }
};

const getCardData = async cardID => {
  try {
    return await db.query(`
            SELECT bank, number, managed_by
            FROM bank_cards
            WHERE id = ${cardID};
        `);
  } catch (error) {
    logger.error('[getCardData]', error);
    return null;
  }
};

module.exports = {
  getExpiredBookingCards,
  clearCardBookingByID,
  getExpiredReservations,
  getUnbookedCardsWithExpirations,
  addCardReservationByWallet,
  reserveTheCard,
  getAvailableCards,
  getWalletReservation,
  cancelCardReservation,
  cancelBooking,
  sendToReview,
  approveReservation,
  getReservationById,
  getAvailableBanks,
  getCardData,
  sendToAdminReview,
};
