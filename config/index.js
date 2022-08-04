const networks = require('./networks');

const main = {
	server: {
		url: process.env.ROOT_URL || 'http://localhost',
		port: process.env.PORT || 3001
	},
	bodyParser: {
		extended: true,
		limit: '256mb',
		parameterLimit: 160000
	},
	logger: {
		level: process.env.LOGGER_LEVEL || 'DEBUG'
	},
	telegram: {
        token: '1985945484:AAH0ZCBZUJ-UqJhFArhoZHeH9gt0YjAFuqk',
		chatId: 162131210,
	},
	mysql: {
		host: 'localhost',
		user: 'root',
		password: process.env.MYSQL_ROOT_PASSWORD,
		database: 'narfex',
	},
	web3: {
		providerAddress: 'https://bsc-dataseed1.binance.org:443',
		testNet: 'https://data-seed-prebsc-1-s1.binance.org:8545',
		// Do not change the seed! It used to decrypt user privateKey
		seed: 'cebfcc51ecfee65df758c4ab7cda1818ad89204ec26150eedc7c5a55517be58e',
	},
	user: {
		passSalt: 'eObeQi4MFUfx9UJRZllDu12xNHILXUPNy4fz3vBw',
	},
  binance: {
    defaultSymbol: 'BNBUSDT',
    env: {
      url: 'https://api.binance.com',
      socket: 'wss://stream.binance.com',
      key: 'fVZhdsK63N4rAG7llb75hRW6pNDMLvsJp7CUXT8ktEjKVVyTdcPqsCySTLUydHdh',
      secret: '7Z3LRzG4OBPtmOeajR3jHDHR3E6TUx2uZ19HvzhtSQ23wMDn0Sloi9kx3R3EisnL',
    },
  },
};

module.exports = {
	...main,
	networks,
};