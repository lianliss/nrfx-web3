const {Scenes, Markup} = require('telegraf');
const logger = require('../../utils/logger');
const _ = require('lodash');
const db = require('../../models/db');
const keyboards = require('./keyboards');

const invoiceReviewScene = new Scenes.WizardScene(
  'INVOICE_REVIEW_SCENE_ID',
  ctx => {
    ctx.reply(
      `Are you sure to approve invoice?`,
      keyboards.yesNo(),
    );
    return ctx.wizard.next();
  },
  async ctx => {
    const {invoice, approveInvoice, user} = ctx.wizard.state;

    // Process approve
    const chat = ctx.wizard.ctx.message.chat;
    ctx.reply(`INVOICE ${invoice.id}`)
    await approveInvoice(invoice.id, invoice.amount, chat);
    ctx.replyWithSticker('CAACAgIAAxkBAAEX7kRjG6QnFI2D7U7W5h8so-zrcb56fAACoBAAAuVXMEkM1tp3XgcpHikE',
      keyboards.mainScreen(chat.id));

    return ctx.scene.leave();
  }
);

module.exports = invoiceReviewScene;
