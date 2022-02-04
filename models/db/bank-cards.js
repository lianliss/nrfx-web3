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

module.exports = {
    getExpiredBookingCards,
    clearCardBookingByID,
};
