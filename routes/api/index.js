const express = require('express');
const router = express.Router();
const walletRouter = require('./wallet');
const swapRouter = require('./swap');

router.use('/wallet', walletRouter);
router.use('/swap', swapRouter);

module.exports = router;
