const express = require('express');
const router = express.Router();
const {authWallet, authLocal} = require('../../controllers/auth');
const cardsController = require('../../controllers/cards');

router.get('/reservation', cardsController.getReservation);
router.get('/banks', cardsController.getAvailableBanks);
router.post('/reservation', authWallet, cardsController.addReservation);
router.post('/approve', authLocal, cardsController.approveTopup);
router.post('/confirm', authWallet, cardsController.sendToReview);
router.post('/cancel', authWallet, cardsController.cancelReservation);

module.exports = router;
