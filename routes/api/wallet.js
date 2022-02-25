const express = require('express');
const router = express.Router();
const {auth} = require('../../controllers/auth');
const walletController = require('../../controllers/wallet');

router.get('/all', auth, walletController.getWallets);
router.get('/privateKey', auth, walletController.getPrivateKey);
router.get('/balances', auth, walletController.getBalances);
router.get('/balances/default', auth, walletController.getDefaultAccountBalances);
//router.post('/receiveBonus', auth, walletController.receiveBonus);
router.post('/create', auth, walletController.createWallet);
router.post('/import', auth, walletController.importWallet);
router.post('/privateKey', auth, walletController.importPrivateKey);
router.post('/delete', auth, walletController.deleteWallet);
router.post('/transfer', auth, walletController.transfer);

module.exports = router;
