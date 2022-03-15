const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');
const DataModel = require('./data-model');

const model = new DataModel({
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
            WHERE book_expiration < ${Date.now() / 1000}
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
            WHERE cards.book_expiration < ${Date.now() / 1000}
            AND ops.status = 'wait_for_pay'
            AND cards.booked_by IS NOT NULL;
        `);
    } catch (error) {
        logger.error('[getExpiredReservations]', error);
        return null;
    }
}

module.exports = {
    getExpiredBookingCards,
    clearCardBookingByID,
    getExpiredReservations,
};
