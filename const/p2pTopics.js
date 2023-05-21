const logger = require('../utils/logger');
const web3Service = require('../services/web3');
const buyFactoryABI = require('../const/ABI/p2p/buyFactory');
const buyOfferABI = require('../const/ABI/p2p/buy');
const sellOfferABI = require('../const/ABI/p2p/sell');

const getEventTopic = (abi, name) => web3Service.web3.eth.abi.encodeEventSignature(
  abi.find(t => t.type === 'event' && t.name === name)
);

const factoryEvents = {
  CreateOffer: getEventTopic(buyFactoryABI, 'CreateOffer'),
};

const offerEvents = {};
[
  'P2pOfferBlacklisted',
  'P2pOfferUnblacklisted',
  'P2pOfferDisable',
  'P2pOfferEnable',
  'P2pOfferScheduleUpdate',
  'P2pOfferAddBankAccount',
  'P2pOfferClearBankAccount',
  'P2pOfferKYCRequired',
  'P2pOfferKYCUnrequired',
  'P2pOfferSetCommission',
  'P2pCreateTrade',
  'P2pOfferWithdraw',
  'P2pSetLawyer',
  'P2pConfirmTrade',
  'P2pCancelTrade',
  'P2pSetTradeAmounts',
].map(event => {
  offerEvents[event] = getEventTopic(buyOfferABI, event);
});

[
  'P2pOfferSetLimit',
].map(event => {
  offerEvents[event] = getEventTopic(sellOfferABI, event);
});

module.exports = {
  factoryEvents,
  offerEvents,
};
