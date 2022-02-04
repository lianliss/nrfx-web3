const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../models/db');

module.exports = {
    name: 'Bank cards reservations clean',
    action: async () => {
        // Get bank cards and its operations
        const data = await Promise.all([
            db.getExpiredBookingCards(),
            db.getAwaitingBankCardsOperations(),
        ]);
        const cards = data[0].map(card => card.id);
        const operations = data[1];

        const expiredOperations = operations.filter(operation => _.includes(cards, operation.cardID));

        // Clean reservations
        await Promise.all([
            ...cards.map(id => db.clearCardBookingByID(id)),
            ...expiredOperations.map(operation => db.expireBankCardOperation(operation.id)),
        ]);

        return {
            cards: cards.length,
            operations: expiredOperations.length,
        }
    }
};
