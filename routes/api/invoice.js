const express = require('express');
const router = express.Router();
const {authWallet, authLocal} = require('../../controllers/auth');
const invoiceController = require('../../controllers/invoices');
const multer  = require('multer');
const logger = require('../../utils/logger');
const _ = require('lodash');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp')
  },
  filename: function (req, file, cb) {
    const extension = file.mimetype === 'image/jpeg' ? 'jpg' : 'png';
    cb(null, file.fieldname + '-' + Date.now() + '.' + extension)
  }
});

const fileFilter = (req, file, cb) => {
  if (_.includes(['image/jpeg', 'image/png'], file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({ storage, fileFilter });

router.post('/', authWallet, invoiceController.addInvoice);
router.get('/', authWallet, invoiceController.getInvoice);
router.get('/pdf', authWallet, invoiceController.getPDF);
router.post('/review', authWallet, invoiceController.reviewInvoice);
router.post('/screenshot', authWallet, upload.single('file'), invoiceController.addInvoiceScreenshot);
router.post('/confirm', authLocal, invoiceController.confirmInvoice);
router.post('/cancel', authWallet, invoiceController.cancelInvoice);

module.exports = router;
