const express = require('express');
const router = express.Router();
const {auth, authWallet} = require('../../controllers/auth');
const userController = require('../../controllers/user');
const kycController = require('../../controllers/kyc');

router.get('/', auth, userController.getUserData);
router.post('/referPercent', auth, userController.setReferPercent);
router.post('/telegram', auth, userController.setUserTelegramID);
router.get('/kycToken', authWallet, kycController.getAccessToken);
router.get('/p2p/telegram', auth, userController.getP2pUserTelegram);
router.post('/p2p/telegram', auth, userController.setP2pUserTelegram);
router.post('/p2p/settings', auth, userController.setP2pUserSettings);

module.exports = router;
