const express = require('express');
const router = express.Router();

router.use('/wallet', require('./wallet'));
router.use('/swap', require('./swap'));
router.use('/rates', require('./rates'));
router.use('/stream', require('./stream'));
router.use('/local', require('./local'));
router.use('/user', require('./user'));
router.use('/stats', require('./stats'));
router.use('/cards', require('./cards'));
router.use('/invoice', require('./invoice'));
router.use('/withdraw', require('./withdraw'));
router.use('/refer', require('./refer'));
router.use('/history', require('./history'));
router.use('/webhook', require('./webhook'));
router.use('/offers', require('./offers'));

module.exports = router;
