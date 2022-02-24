const express = require('express');
const router = express.Router();
const walletRouter = require('./wallet');
const swapRouter = require('./swap');
const ratesRouter = require('./rates');
const streamRouter = require('./stream');

router.use('/wallet', walletRouter);
router.use('/swap', swapRouter);
router.use('/rates', ratesRouter);
router.use('/stream', streamRouter);

module.exports = router;
