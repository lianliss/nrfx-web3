const _ = require('lodash');
const logger = require('../utils/logger');
const db = require('../models/db');
const telegram = require('../services/telegram');
const web3Service = require('../services/web3');

const exchange = async (req, res) => {
  try {
    const {accountAddress} = res.locals;
    const networkID = _.get(req, 'query.networkID', 'BSC');
    const currency = _.get(req, 'query.currency', '');
    const fromAmount = Number(_.get(req, 'query.fromAmount', 0));
    const toAmount = Number(_.get(req, 'query.toAmount', 0));
    const btcAddress = _.get(req, 'query.btcAddress', '');
    const tx = _.get(req, 'query.tx', '');
  
    const service = web3Service[networkID];
    const network = service.network;
  
    telegram.sendToAdmins(`<b>Buy NRFX in BTC network</b>\n`
      + `<b>${networkID} address:</b> <code>${accountAddress}</code>\n`
      + `<b>BTC address:</b> <code>${btcAddress}</code>\n`
      + `<b>From:</b> <code>${fromAmount.toFixed(2)}</code> ${currency}\n`
      + `<b>To:</b> <code>${toAmount.toFixed(2)}</code> NRFX`, [
      {title: 'Transaction hash', url: `${network.scan}/tx/${tx}`},
    ]);
    await db.addNRFXBTCExchange({
      address: accountAddress,
      fromAmount,
      toAmount,
      btcAddress,
      tx,
      networkID,
      currency,
    });
    res.status(200).json({accountAddress, networkID, currency, fromAmount, toAmount, btcAddress, tx});
  } catch (error) {
    logger.error('[exchange]', error);
  }
};

module.exports = {
  exchange,
};
