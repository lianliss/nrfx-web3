const express = require('express');
const router = express.Router();
const {authWallet, authLocal} = require('../../controllers/auth');
const offersController = require('../../controllers/offers');

router.get('/', offersController.getOffers);
router.get('/banks', offersController.getBanks);
router.get('/single', offersController.getOffer);
router.get('/validator', authWallet, offersController.getValidatorOffers);
router.post('/update', authWallet, offersController.updateOffer);
router.post('/terms', authWallet, offersController.updateOfferTerms);

module.exports = router;
