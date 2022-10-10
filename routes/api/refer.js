const express = require('express');
const router = express.Router();
const {authWallet, authLocal} = require('../../controllers/auth');
const referController = require('../../controllers/refers');

router.get('/hash', authWallet, referController.getHash);
router.post('/hash', authWallet, referController.setRefer);
router.get('/', authWallet, referController.getInvites);
router.get('/rewards', authWallet, referController.getRewards);

module.exports = router;
