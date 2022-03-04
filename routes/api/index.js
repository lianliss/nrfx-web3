const express = require('express');
const router = express.Router();

router.use('/wallet', require('./wallet'));
router.use('/swap', require('./swap'));
router.use('/rates', require('./rates'));
router.use('/stream', require('./stream'));
router.use('/local', require('./local'));
router.use('/user', require('./user'));

module.exports = router;
