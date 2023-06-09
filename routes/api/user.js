const express = require('express');
const router = express.Router();
const {auth, authWallet} = require('../../controllers/auth');
const userController = require('../../controllers/user');
const kycController = require('../../controllers/kyc');

router.get('/', auth, userController.getUserData);
router.post('/referPercent', auth, userController.setReferPercent);
router.post('/telegram', auth, userController.setUserTelegramID);
router.get('/kycToken', authWallet, kycController.getAccessToken);
router.get('/p2p/telegram', authWallet, userController.getP2pUserTelegram);
router.post('/p2p/telegram', authWallet, userController.setP2pUserTelegram);
router.post('/p2p/settings', authWallet, userController.setP2pUserSettings);
router.get('/p2p/settings', authWallet, userController.getP2pUserSettings);

module.exports = router;
