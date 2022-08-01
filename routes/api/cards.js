const express = require('express');
const router = express.Router();
const {authWallet} = require('../../controllers/auth');
const cardsController = require('../../controllers/cards');

router.get('/reservation', cardsController.getReservation);
router.post('/reservation', authWallet, cardsController.addReservation);

module.exports = router;
