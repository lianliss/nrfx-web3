const express = require('express');
const router = express.Router();
const {auth} = require('../../controllers/auth');
const userController = require('../../controllers/user');

router.get('/', auth, userController.getUserData);
router.post('/referPercent', auth, userController.setReferPercent);
router.post('/telegram', auth, userController.setUserTelegramID);

module.exports = router;
