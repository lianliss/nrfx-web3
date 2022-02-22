const _ = require('lodash');
const logger = require('../utils/logger');
const errors = require('../models/error');
const User = require('../models/user');
const web3Service = require('../services/web3');
const db = require('../models/db');

/**
 * Promo codes must be in uppercase
 */
const BONUS_CODES = {
    'BALI2022': 5,
};

/**
 * Agents logins must be in lowercase
 */
const BONUS_AGENTS = {
    'olivia': 5,
    'kandalin': 5,
};

const getBonusValue = async user => {
    try {
        const {refer, isBonusReceived,} = user;
        if (isBonusReceived) return 0;

        const agentID = Number(refer);
        if (agentID) {
            // Get refer agent
            const agent = await User.getByID(agentID);
            const login = _.get(agent, 'login', '').toLowerCase();
            return _.get(BONUS_AGENTS, login, 0);
        } else {
            // Get promo code
            const promoCode = refer.trim().toUpperCase();
            return _.get(BONUS_CODES, promoCode, 0);
        }
    } catch (error) {
        logger.error('[getBonusValue]', error);
        throw error;
    }
};

const receiveBonus = async user => {
    try {
        const {refer, isBonusReceived, userID,} = user;

        // Check if the bonus was received
        if (isBonusReceived) {
            throw new errors.BonusReceivedError();
        }

        // Get user wallet address
        const address = _.get(user, 'wallets[0].data.address');
        if (!address) {
            throw new errors.NoWalletsError();
        }

        // Get current bonus value
        const bonus = await getBonusValue(user);

        // Send bonus
        await web3Service.transfer(
            address,
            'nrfx',
            bonus / 0.98, // Compensate 2% fee
        );
        await db.setBonusReceived(userID);
        user.isBonusReceived = true;

        return {
            bonus,
            address,
        }
    } catch (error) {
        logger.error('[receiveBonus]', error);
        throw error;
    }
};

module.exports = {
    receiveBonus,
    getBonusValue,
};
