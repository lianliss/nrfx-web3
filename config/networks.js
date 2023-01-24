const networks = {
  BSC: {
    name: 'Binance Smart Chain',
    chainId: 56,
    fiatDecimals: 18,
    providerAddress: 'https://bsc-dataseed1.defibit.io:443',
    providerWss: 'wss://rpc.ankr.com/bsc/ws/6c2f34a42715fa4c50762b0069a7a658618c752709b7db32f7bfe442741117eb',
    defaultToken: 'bnb',
    defaultAccount: '0xa4FF4DBb11F3186a1e96d3e8DD232E31159Ded9B',
    scan: 'https://bscscan.com',
    contracts: {
      wrap: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      usdt: '0x55d398326f99059ff775485246999027b3197955',
      usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      fiatFactory: '0xF9ceb479201054d2B301f9052A5fFBe47D652358',
      exchangeRouter: '0x9af372bEAfe51bD4920110834187DFB3679F150E',
      exchangePool: '0x38d269BFeECD9871291357F3795E86ae8872A2D8',
      oracle: '0xE948F3AE41105118A48B0a656f59C5B4113d404e',
      defaultRefer: '0x08AbC7831db337419579EC1CD36460B47A1Df492',
    },
    fiats: {
      USD: '0xc0Bd103de432a939F93E1E2f8Bf1e5C795774F90',
      EUR: '0xa702e05965FEd09FDDFE4ca182b0915CdBa367c8',
      RUB: '0xC7b9dA3D064a918B8e04B23AEEdBD64CBa21D37d',
      UAH: '0xcAA5eb94f5339a598580A68f88F1471c36599dDA',
      CNY: '0xA61Feb03EB111373a84A4b303Ea391140fa3291c',
      IDR: '0x814b62d5a157498145c59820763430Ce7558bA6e',
      PLN: '0x815fe8056d867052bde314018166f144c11f6c4c',
      THB: '0xf21311db1d6ae2538dc86a0bbc751c53439e0895',
      VND: '0x9a630ef70abf193bb24b082d7a10c515c0e847c6',
      CAD: '0x1ade4f9b177a42b160cb304ce402f1daabfb2d2d',
      TRY: '0x8845161A0EA235F9e94c815241A0e63AcbaC144B',
      GBP: '0xC00565016486b345BefdD38c6BEA3A4E497F7633',
    },
  },
  ETH: {
    name: 'Ether',
    chainId: 1,
    fiatDecimals: 6,
    providerAddress: 'https://rpc.ankr.com/eth/6c2f34a42715fa4c50762b0069a7a658618c752709b7db32f7bfe442741117eb',
    providerWss: 'wss://rpc.ankr.com/eth/ws/6c2f34a42715fa4c50762b0069a7a658618c752709b7db32f7bfe442741117eb',
    defaultToken: 'eth',
    defaultAccount: '0xa4FF4DBb11F3186a1e96d3e8DD232E31159Ded9B',
    scan: 'https://etherscan.com',
    contracts: {
      wrap: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      usdt: '0x55d398326f99059ff775485246999027b3197955',
      usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      fiatFactory: '0xcDA8eD22bB27Fe84615f368D09B5A8Afe4a99320',
      exchangeRouter: '0xebDEC768d466157c533f5b93F4ED8f30F42B4e68',
      exchangePool: '0xAD1Fc0E22C13159884Cf9FD1d46e3C2Ad60C8F36',
      oracle: '0xBaBfFCe575929DDd7aD29DEEeb5B7A5F5dee4Ab6',
      defaultRefer: '0x08AbC7831db337419579EC1CD36460B47A1Df492',
    },
    fiats: {
      RUB: '0x5E11E947e69e8e6267e28C3db9425acd3AA4B489',
      IDR: '0x5624e3A00DdfC29765b4e164cD0dC38bFf0FC3a6',
    },
  },
  TON: {
    name: 'Telegram Open Network',
    providerAddress: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: 'c1f8abc113c9c0458cb079a995427f5558d437b00f8ef09bf34452a0556fb002',
    defaultToken: 'ton',
    defaultAccount: 'EQCaFlFd8RL9_nA2X-y7nh3Gpr2y3gSZjPK4ncbMQxN6V60U',
    contracts: {},
  },
};

networks[1] = networks.ETH;
networks[56] = networks.BSC;
networks['BEP20'] = networks.BSC;

module.exports = networks;
