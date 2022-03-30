const _ = require('lodash');
const logger = require('../utils/logger');
const db = require('../models/db');
const errors = require('../models/error');
const xl = require('excel4node');

/**
 * Returns money operations statistic
 * @param req
 * @param res
 */
const getOperations = (req, res) => {
    (async () => {
        try {
            const {user} = res.locals;
            if (!user.isAdmin) throw new errors.PermissionDeniedError();

            // Get DB data
            const data = await Promise.all([
                db.getBalancesHistory(),
                db.getBankCardOperations(),
            ]);

            // Create a book
            const wb = new xl.Workbook({
                defaultFont: {
                    size: 12,
                    name: 'Calibri',
                },
                author: 'Narfex',
            });

            const operations = wb.addWorksheet('Bank Operations');
            operations.cell(1, 1).string('ID');
            operations.cell(1, 2).string('Date');
            operations.cell(1, 3).string('ManagerID');
            operations.cell(1, 4).string('Manager');
            operations.cell(1, 5).string('Card');
            operations.cell(1, 6).string('Amount');
            operations.cell(1, 7).string('Fee');
            operations.cell(1, 8).string('UserID');
            operations.cell(1, 9).string('First Name');
            operations.cell(1, 10).string('Last Name');
            operations.cell(1, 11).string('Login');
            operations.cell(1, 12).string('Email');

            const swaps = wb.addWorksheet('Swaps');
            swaps.cell(1, 1).string('ID');
            swaps.cell(1, 2).string('Date');
            swaps.cell(1, 3).string('Amount');
            swaps.cell(1, 4).string('From');
            swaps.cell(1, 5).string('To');
            swaps.cell(1, 6).string('Tokens');
            swaps.cell(1, 7).string('Price');
            swaps.cell(1, 8).string('Comm');
            swaps.cell(1, 9).string('UserID');
            swaps.cell(1, 10).string('First Name');
            swaps.cell(1, 11).string('Last Name');
            swaps.cell(1, 12).string('Login');
            swaps.cell(1, 13).string('Email');

            // Process bank cards operations
            data[1].map((row, index) => {
                const i = index + 2;
                let extra = {};
                try {
                    extra = JSON.parse(row.extra);
                } catch (error) {
                    logger.warn("[getOperations] Can't parse Bank Operations", row.id);
                }

                swaps.cell(i, 1)
                    .number(row.id);
                swaps.cell(i, 2)
                    .date(new Date(row.created_at_timestamp * 1000));
                swaps.cell(i, 3)
                    .number(row.amount);
                swaps.cell(i, 4)
                    .string(extra.from_currency || '');
                swaps.cell(i, 5)
                    .string(extra.to_currency || '');
                swaps.cell(i, 6)
                    .number(extra.crypto_amount || 0);
                swaps.cell(i, 7)
                    .number(extra.price || 0);
                swaps.cell(i, 8)
                    .number(extra.commission || 0);
                swaps.cell(i, 9)
                    .number(row.user_id);
                swaps.cell(i, 10)
                    .string(row.first_name);
                swaps.cell(i, 11)
                    .string(row.last_name);
                swaps.cell(i, 12)
                    .string(row.login);
                swaps.cell(i, 13)
                    .string(row.email);
            });

            // Process swaps
            data[0].map((row, index) => {
                const i = index + 2;

                operations.cell(i, 1)
                    .number(row.id);
                operations.cell(i, 2)
                    .date(new Date(row.created_at_timestamp * 1000));
                operations.cell(i, 3)
                    .number(row.manager_id);
                operations.cell(i, 4)
                    .string(row.manager);
                operations.cell(i, 5)
                    .string(row.card);
                operations.cell(i, 6)
                    .number(row.amount);
                operations.cell(i, 7)
                    .number(row.fee);
                operations.cell(i, 8)
                    .number(row.user_id);
                operations.cell(i, 9)
                    .string(row.first_name);
                operations.cell(i, 10)
                    .string(row.last_name);
                operations.cell(i, 11)
                    .string(row.login);
                operations.cell(i, 12)
                    .string(row.email);
            });

            wb.write(`Stats${Date.now()}.xlsx`, res);
        } catch (error) {
            logger.error('[statisticController][getOperations]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

module.exports = {
    getOperations,
};
