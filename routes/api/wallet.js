const express = require('express');
const router = express.Router();
const {auth} = require('../../controllers/auth');
const walletController = require('../../controllers/wallet');

router.get('/all', auth, walletController.getWallets);
router.get('/privateKey', auth, walletController.getPrivateKey);
router.post('/create', auth, walletController.createWallet);
router.post('/import', auth, walletController.importWallet);

module.exports = router;
