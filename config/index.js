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

let telegram = {
  chatId: 162131210,
};
switch (true) {
	case process.env.ROOT_URL === 'http://web3.nrfxlab.world': // Stage
		telegram = {
			...telegram,
			token: '5715042098:AAFwIFbmEQHfWO5RumgIW_-1mo_hQVoPHS8',
			cdCommand: 'cd /var/Stage/Narfex_Project/WebDir/web3',
		};
		break;
	case process.env.NODE_ENV === 'local': // Local
    telegram = {
      ...telegram,
      token: '5729634716:AAHxCk2hPWQmMXVkGpjznf8P15zI0P7X1C0',
      cdCommand: 'cd ./',
    };
		break;
	default: // Production
    telegram = {
      ...telegram,
      token: '1985945484:AAH0ZCBZUJ-UqJhFArhoZHeH9gt0YjAFuqk',
      cdCommand: 'cd /mnt/HC_Volume_15774891/Narfex_Project/WebDir/web3',
    };
}

module.exports = {
	...main,
	telegram,
	networks,
};