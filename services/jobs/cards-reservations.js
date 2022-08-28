const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../models/db');

module.exports = {
    name: 'Bank cards reservations clean',
    action: async () => {
        try {
            // Get bank cards and its operations
            const data = await Promise.all([
                db.getExpiredReservations(),
            ]);
            const reservations = data[0];
            const cards = _.uniqBy(reservations, 'id');

            // Clean reservations
            await Promise.all([
                ...cards.map(card => db.clearCardBookingByID(Number(card.id))),
                ...reservations.map(res => db.expireBankCardOperation(Number(res.operation_id))),
            ]);

            return !!cards.length || !!reservations.length
                ? {
                    cards: cards.length,
                    operations: reservations.length,
                }
                : null;
        } catch (error) {
            logger.error('Job Bank cards reservations clean', error);
            return null;
        }
    }
};
