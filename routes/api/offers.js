const express = require('express');
const router = express.Router();
const {authWallet, authLocal} = require('../../controllers/auth');
const offersController = require('../../controllers/offers');

router.get('/', offersController.getOffers);
router.get('/single', offersController.getOffer);
router.get('/validator', authWallet, offersController.getValidatorOffers);

module.exports = router;
