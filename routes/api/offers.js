const express = require('express');
const router = express.Router();
const {authWallet, authLocal} = require('../../controllers/auth');
const offersController = require('../../controllers/offers');

router.get('/', offersController.getOffers);
router.get('/banks', offersController.getBanks);
router.get('/single', offersController.getOffer);
router.get('/single/banks', offersController.getOfferBanks);
router.post('/single/banks', authWallet, offersController.updateOfferBanks);
router.get('/validator', authWallet, offersController.getValidatorOffers);
router.get('/trades', offersController.getTrades);
router.post('/update', authWallet, offersController.updateOffer);
router.post('/terms', authWallet, offersController.updateOfferTerms);
router.post('/payed', authWallet, offersController.setTradeIsPayed);

module.exports = router;
