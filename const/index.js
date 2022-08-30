module.exports = {
  localhost: 'http://localhost',
  REFER_NRFX_ACCRUAL: 0.05,
  TOKENS: [
    'nrfx',
    'usdt',
    'busd',
    'bnb',
    'ton',
  ],
  FIATS: [
    'rub',
    'idr',
    'uah',
    'cny',
  ],
  FIATS_PAYTYPES: {
    RUB: ['RosBank', 'Tinkoff'],
    IDR: ['BANK'],
    UAH: ['PrivatBank', 'Monobank'],
    CNY: ['BANK'],
    USD: ['BANK'],
  },
  GET_RATE_INTERVAL: 60 * 1000,
  GET_BINANCE_RATE_INTERVAL: 60 * 2 * 1000,
  GET_BINANCE_WITHDRAWS_INTERVAL: 1000 * 30,
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  FIAT_FACTORY: '0xF9ceb479201054d2B301f9052A5fFBe47D652358',
};