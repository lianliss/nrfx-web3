const express = require('express');
const router = express.Router();
const {authWallet, authLocal} = require('../../controllers/auth');
const statsController = require('../../controllers/statistic');

router.get('/', authWallet, statsController.getAccountHistory);

module.exports = router;
