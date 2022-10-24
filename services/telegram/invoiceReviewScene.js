const {Scenes, Markup} = require('telegraf');
const logger = require('../../utils/logger');
const _ = require('lodash');
const db = require('../../models/db');
const keyboards = require('./keyboards');

const invoiceReviewScene = new Scenes.WizardScene(
  'INVOICE_REVIEW_SCENE_ID',
  ctx => {
    const {invoice} = ctx.wizard.state;
    ctx.reply(
      `Enter the received amount of ${invoice.currency}`,
    );
    return ctx.wizard.next();
  },
  async ctx => {
    const {invoice} = ctx.wizard.state;
    const textValue = ctx.message.text.replace(',', '.');
    const numberValue = Number(textValue);
    if (!numberValue) {
      return ctx.wizard.back();
    }
    const oldAmount = invoice.amount;
    ctx.wizard.state.invoice.amount = numberValue;
    ctx.reply(
      `Are you sure to approve `
      +`<b>${numberValue.toFixed(2)}</b>${invoice.currency}`
      +` of <b>${oldAmount}</b>${invoice.currency}?`,
      keyboards.yesNo(),
    );
    return ctx.wizard.next();
  },
  async ctx => {
    const {invoice, approveInvoice, user, amount} = ctx.wizard.state;
    const chat = ctx.wizard.ctx.message.chat;

    if (!user.isAdmin || ctx.message.text !== keyboards.buttons.yes) {
      ctx.reply('Go back', keyboards.mainScreen(chat.id));
      return ctx.scene.leave();
    }

    // Process approve
    await approveInvoice(invoice.id, invoice.amount, chat);
    ctx.replyWithSticker('CAACAgIAAxkBAAEX7kRjG6QnFI2D7U7W5h8so-zrcb56fAACoBAAAuVXMEkM1tp3XgcpHikE',
      keyboards.mainScreen(chat.id));

    return ctx.scene.leave();
  }
);

module.exports = invoiceReviewScene;
