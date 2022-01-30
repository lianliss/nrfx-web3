const express = require('express');
const router = express.Router();
const walletRouter = require('./wallet');
const swapRouter = require('./swap');
const ratesRouter = require('./swap');

router.use('/wallet', walletRouter);
router.use('/swap', swapRouter);
router.use('/rates', ratesRouter);

module.exports = router;
