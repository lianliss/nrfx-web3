const express = require('express');
const router = express.Router();
const {authWallet, authLocal} = require('../../controllers/auth');
const invoiceController = require('../../controllers/invoices');

router.post('/', authWallet, invoiceController.addInvoice);
router.get('/', authWallet, invoiceController.getInvoice);
router.get('/pdf', authWallet, invoiceController.getPDF);
router.post('/review', authWallet, invoiceController.reviewInvoice);
router.post('/confirm', authLocal, invoiceController.confirmInvoice);
router.post('/cancel', authWallet, invoiceController.cancelInvoice);

module.exports = router;
