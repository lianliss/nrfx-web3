const express = require('express');
const router = express.Router();
const {auth} = require('../../controllers/auth');
const streamController = require('../../controllers/stream');

router.get('/fiats', streamController.sendFiatBalanceToUser);

module.exports = router;
