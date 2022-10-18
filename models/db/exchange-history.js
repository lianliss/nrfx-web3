const _ = require('lodash');
const logger = require('../../utils/logger');
const db = require('../../services/mysql');

const getHistoryRequest = `
SELECT
	h.type,
	h.request_id,
	h.account_address,
	h.source_currency,
	h.target_currency,
	h.commission_currency,
	h.source_amount,
	h.target_amount,
	h.commission,
	h.refer_reward,
	h.timestamp,
	CASE h.type
		WHEN 'topup' THEN t.card
		WHEN 'withdraw' THEN w.card
		WHEN 'invoice' THEN i.phone
		ELSE NULL
	END AS card,
	CASE h.type
		WHEN 'topup' THEN t.holder
		WHEN 'withdraw' THEN w.holder
		WHEN 'invoice' THEN CONCAT(i.name, ' ', i.last_name)
		ELSE NULL
	END AS holder,
	CASE h.type
		WHEN 'topup' THEN t.bank
		WHEN 'withdraw' THEN w.bank
		ELSE NULL
	END AS bank,
	CASE h.type
		WHEN 'topup' THEN t.manager_id
		WHEN 'withdraw' THEN w.manager_id
		ELSE NULL
	END AS manager_id,
	CASE h.type
		WHEN 'topup' THEN t.manager_first
		WHEN 'withdraw' THEN w.manager_first
		ELSE NULL
	END AS manager_first,
	CASE h.type
		WHEN 'topup' THEN t.manager_last
		WHEN 'withdraw' THEN w.manager_last
		ELSE NULL
	END AS manager_last,
	h.tx_hash
FROM exchange_history AS h
LEFT JOIN (
	SELECT
		o.id AS id,
		c.number AS card,
		c.holder_name AS holder,
		c.bank AS bank,
		c.managed_by AS manager_id,
		u.first_name AS manager_first,
		u.last_name AS manager_last
	FROM bank_cards_operations AS o
	INNER JOIN bank_cards AS c
	ON o.card_id = c.id
	INNER JOIN users AS u
	ON c.managed_by = u.id
) AS t
ON h.request_id = t.id
LEFT JOIN (
	SELECT
		w.id AS id,
		w.account_number AS card,
		w.account_holder_name AS holder,
		w.bank_code AS bank,
		w.admin_id AS manager_id,
		u.first_name AS manager_first,
		u.last_name AS manager_last
	FROM withdrawals AS w
	INNER JOIN users AS u
	ON w.admin_id = u.id
) AS w
ON h.request_id = w.id
LEFT JOIN fiat_invoices AS i
ON h.request_id = i.id
WHERE h.is_completed = 1
`;

const addExchangeHistory = async ({
  type,
  requestID = 0,
  accountAddress,
  sourceCurrency,
  targetCurrency,
  commissionCurrency = '',
  sourceAmount,
  targetAmount,
  commission = 0,
  referReward = 0,
  txHash = '',
  isCompleted = true,
                                  }) => {
  try {
    return await db.query(`
            INSERT INTO exchange_history
            (
            type,
            request_id,
            account_address,
            source_currency,
            target_currency,
            commission_currency,
            source_amount,
            target_amount,
            commission,
            refer_reward,
            timestamp,
            tx_hash,
            is_completed
            )
            VALUES
            (
              '${type}',
              ${requestID},
              '${accountAddress}',
              '${sourceCurrency}',
              '${targetCurrency}',
              '${commissionCurrency}',
              ${sourceAmount},
              ${targetAmount},
              ${commission},
              ${referReward},
              ${Math.floor(Date.now() / 1000)},
              '${txHash}',
              ${isCompleted ? 1 : 0}
            );
        `);
  } catch (error) {
    logger.error('[addExchangeHistory]', error);
    return null;
  }
};

const getExchangeHistory = async () => {
  try {
    return await db.query(`${getHistoryRequest};`);
  } catch (error) {
    logger.error('[getExchangeHistory]', error);
    return [];
  }
};

const getExchangeHistoryAfter = async timestamp => {
  try {
    return await db.query(`${getHistoryRequest}
AND h.timestamp >= ${Math.floor(timestamp / 1000)};
        `);
  } catch (error) {
    logger.error('[getExchangeHistoryAfter]', error);
    return [];
  }
};

const getAccountHistory = async accountAddress => {
  try {
    return await db.query(`
            SELECT
            type,
            source_currency,
            target_currency,
            source_amount,
            target_amount,
            timestamp
            FROM exchange_history
            WHERE account_address = '${accountAddress}'
            AND is_completed = 1;
        `);
  } catch (error) {
    logger.error('[getAccountHistory]', error);
    return [];
  }
};

const completeWithdrawHistory = async withdrawId => {
  try {
    return await db.query(`
            UPDATE exchange_history
            SET is_completed = 1
            WHERE request_id = ${withdrawId}
            AND type = 'withdraw';
        `);
  } catch (error) {
    logger.error('[completeWithdrawHistory]', error);
    return null;
  }
};

module.exports = {
  addExchangeHistory,
  getExchangeHistory,
  getExchangeHistoryAfter,
  getAccountHistory,
  completeWithdrawHistory,
};