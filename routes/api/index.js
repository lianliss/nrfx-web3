const express = require('express');
const router = express.Router();
const walletRouter = require('./wallet');

router.use('/wallet', walletRouter);

module.exports = router;
