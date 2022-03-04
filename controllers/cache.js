const _ = require('lodash');
const logger = require('../utils/logger');
const cache = require('../models/cache');

const clearUserCache = (req, res) => {
    (async () => {
        try {
            const userID = Number(_.get(req, 'query.userID'));
            const userCache = cache.users[userID];
            if (!userCache) return res.status(200).json({result: 0});

            userCache.tokens.map(tokenPair => {
                delete cache.usersByTokens[tokenPair];
            });
            delete cache.users[userID];
            res.status(200).json({result: 1});
        } catch (error) {
            logger.error('[cacheController][clearUserCache]', error);
            res.status(500).json({
                name: error.name,
                message: error.message,
            });
        }
    })();
};

module.exports = {
    clearUserCache,
};
