const express = require('express');
const router = express.Router();
const {auth} = require('../../controllers/auth');
const ratesController = require('../../controllers/rates');

router.get('/', ratesController.getAllRates);
router.get('/fiat', ratesController.getCurrencyUSDPrice);
router.get('/token', ratesController.getCurrencyUSDPrice);

module.exports = router;
