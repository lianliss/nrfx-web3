const express = require('express');
const router = express.Router();
const {auth, authWallet} = require('../../controllers/auth');
const swapController = require('../../controllers/swap');
const btcController = require('../../controllers/btc-nrfx');

router.get('/rate', auth, swapController.getFiatToTokenRate);
router.post('/exchange', authWallet, btcController.exchange);

module.exports = router;
