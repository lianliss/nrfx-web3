const express = require('express');
const router = express.Router();
const {auth} = require('../../controllers/auth');
const webhookController = require('../../controllers/webhook');

router.post('/kyc', webhookController.processKYC);

module.exports = router;