const events = {
  createOffer: {
    "anonymous": false,
    "inputs": [{"indexed": true, "internalType": "address", "name": "validator", "type": "address"}, {
      "indexed": true,
      "internalType": "address",
      "name": "fiatAddress",
      "type": "address"
    }, {"indexed": false, "internalType": "address", "name": "offer", "type": "address"}, {
      "indexed": false,
      "internalType": "bool",
      "name": "isBuy",
      "type": "bool"
    }],
    "name": "CreateOffer",
    "type": "event"
  },
  addBankAccount: {
    "anonymous": false,
    "inputs": [{"indexed": false, "internalType": "uint256", "name": "_index", "type": "uint256"}, {
      "indexed": false,
      "internalType": "string",
      "name": "_jsonData",
      "type": "string"
    }],
    "name": "AddBankAccount",
    "type": "event"
  },
  clearBankAccount: {
    "anonymous": false,
    "inputs": [{"indexed": false, "internalType": "uint256", "name": "_index", "type": "uint256"}],
    "name": "ClearBankAccount",
    "type": "event"
  },
  disable: {"anonymous": false, "inputs": [], "name": "Disable", "type": "event"},
  enable: {
    "anonymous": false,
    "inputs": [],
    "name": "Enable",
    "type": "event"
  },
  kycRequired: {"anonymous": false, "inputs": [], "name": "KYCRequired", "type": "event"},
  kycUnrequired: {
    "anonymous": false,
    "inputs": [],
    "name": "KYCUnrequired",
    "type": "event"
  },
  setCommission: {
    "anonymous": false,
    "inputs": [{"indexed": false, "internalType": "uint256", "name": "_percents", "type": "uint256"}],
    "name": "SetCommission",
    "type": "event"
  },
  setLimit: {
    "anonymous": false,
    "inputs": [{"indexed": false, "internalType": "uint256", "name": "_offerLimit", "type": "uint256"}],
    "name": "SetLimit",
    "type": "event"
  },
  setLawyer: {
    "anonymous": false,
    "inputs": [{"indexed": false, "internalType": "address", "name": "_client", "type": "address"}, {
      "indexed": false,
      "internalType": "address",
      "name": "_offer",
      "type": "address"
    }, {"indexed": false, "internalType": "address", "name": "_lawyer", "type": "address"}],
    "name": "SetLawyer",
    "type": "event"
  },
  blacklisted: {
    "anonymous": false,
    "inputs": [{"indexed": false, "internalType": "address", "name": "_client", "type": "address"}],
    "name": "Blacklisted",
    "type": "event"
  },
  unblacklisted: {
    "anonymous": false,
    "inputs": [{"indexed": false, "internalType": "address", "name": "_client", "type": "address"}],
    "name": "Unblacklisted",
    "type": "event"
  },
  withdraw: {
    "anonymous": false,
    "inputs": [{"indexed": false, "internalType": "uint256", "name": "_amount", "type": "uint256"}],
    "name": "Withdraw",
    "type": "event"
  },
};

const methods = {
  setSchedule: {
    "inputs": [{"internalType": "bool[24][7]", "name": "_schedule", "type": "bool[24][7]"}],
    "name": "setSchedule",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  createSellTrade: {
    "inputs": [{"internalType": "uint256", "name": "fiatAmount", "type": "uint256"}, {
      "internalType": "string",
      "name": "bankAccount",
      "type": "string"
    }, {"internalType": "bytes32", "name": "clientPublicKey", "type": "bytes32"}],
    "name": "createTrade",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  createBuyTrade: {
    "inputs": [{"internalType": "uint256", "name": "moneyAmount", "type": "uint256"}, {
      "internalType": "uint256",
      "name": "bankAccountId",
      "type": "uint256"
    }], "name": "createTrade", "outputs": [], "stateMutability": "nonpayable", "type": "function"
  },
  createBuyTradeByValidator: {
    "inputs": [{"internalType": "uint256", "name": "moneyAmount", "type": "uint256"}, {
      "internalType": "uint256",
      "name": "bankAccountId",
      "type": "uint256"
    }, {"internalType": "address", "name": "clientAddress", "type": "address"}],
    "name": "createTrade",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
};

module.exports = {
  events,
  methods,
};
