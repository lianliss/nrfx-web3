const express = require('express');
const router = express.Router();
const {authLocal} = require('../../controllers/auth');
const cacheController = require('../../controllers/cache');

router.get('/user/clear', authLocal, cacheController.clearUserCache);

module.exports = router;
