const express = require('express');
const router = express.Router();
const {auth} = require('../../controllers/auth');
const ratesController = require('../../controllers/rates');

router.get('/fiat', ratesController.getFiatUSDPrice);
router.get('/token', ratesController.getTokenUSDPrice);

module.exports = router;
