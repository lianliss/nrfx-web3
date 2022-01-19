const config = require('../config');
const md5 = require('md5');

const getPasswordHash = password => md5(md5(md5(password) + config.user.passSalt));

module.exports = getPasswordHash;
