const express = require('express');
const router = express.Router();
const {auth, authWallet} = require('../../controllers/auth');
const swapController = require('../../controllers/swap');

router.get('/rate', auth, swapController.getFiatToTokenRate);
router.post('/fiatToToken', auth, swapController.swapFiatToToken);
router.get('/fiatToToken', auth, swapController.estimateTransferToUserGas);
router.post('/exchange', authWallet, swapController.exchange);

module.exports = router;
