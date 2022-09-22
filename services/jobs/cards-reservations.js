const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../models/db');
const telegram = require('../../services/telegram');

module.exports = {
    name: 'Bank cards reservations clean',
    action: async () => {
        try {
            // Get bank cards and its operations
            const data = await Promise.all([
                db.getExpiredReservations(),
                db.getUnbookedCardsWithExpirations(),
            ]);
            const reservations = data[0] || [];
            const unbookedCards = data[1] || [];
            const cards = _.uniqBy([
              ...reservations,
              ...unbookedCards,
            ], 'id');

            // Clean reservations
            await Promise.all([
                ...cards.map(card => db.clearCardBookingByID(Number(card.id))),
                ...reservations.map(res => db.expireBankCardOperation(Number(res.operation_id))),
            ]);

            if (!!cards.length || !!reservations.length) {
                telegram.log(`<b>Cleared</b> ${cards.length} cards, ${reservations.length} operations`);
                return {
                  cards: cards.length,
                  operations: reservations.length,
                };
            }
            return null;
        } catch (error) {
            logger.error('Job Bank cards reservations clean', error);
            return null;
        }
    }
};
