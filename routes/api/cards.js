const express = require('express');
const router = express.Router();
const {authWallet, authLocal} = require('../../controllers/auth');
const cardsController = require('../../controllers/cards');

router.get('/reservation', cardsController.getReservation);
router.post('/reservation', authWallet, cardsController.addReservation);
router.post('/approve', authLocal, cardsController.approveTopup);

module.exports = router;
