const express = require('express');
const router = express.Router();
const {auth} = require('../../controllers/auth');
const statsController = require('../../controllers/statistic');

router.get('/', auth, statsController.getOperations);

module.exports = router;
