const express = require('express');
const router = express.Router();
const {auth} = require('../../controllers/auth');
const swapController = require('../../controllers/swap');

router.post('/fiatToToken', auth, swapController.swapFiatToToken);

module.exports = router;
