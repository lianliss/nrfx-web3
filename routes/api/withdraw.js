const express = require('express');
const router = express.Router();
const {authWallet, authLocal} = require('../../controllers/auth');
const withdrawController = require('../../controllers/withdraw');

router.post('/', authWallet, withdrawController.addWithdraw);
router.get('/banks', withdrawController.getWithdrawalBanks);

module.exports = router;
