const express = require('express');
const router = express.Router();
const {auth} = require('../../controllers/auth');
const userController = require('../../controllers/user');
const kycController = require('../../controllers/kyc');

router.get('/', auth, userController.getUserData);
router.post('/referPercent', auth, userController.setReferPercent);
router.post('/telegram', auth, userController.setUserTelegramID);
router.get('/kycToken', auth, kycController.getAccessToken);

module.exports = router;
