const {Scenes, Markup} = require('telegraf');
const logger = require('../../utils/logger');
const _ = require('lodash');
const db = require('../../models/db');
const keyboards = require('./keyboards');

const withdrawDeclineScene = new Scenes.WizardScene(
  'WITHDRAW_DECLINE_SCENE_ID',
  ctx => {
    const {withdraw} = ctx.wizard.state;
    ctx.reply(
      `Are you sure you want to cancel the withdrawal?`
      + ` The user will receive ${withdraw.amount.toFixed(2)} ${withdraw.currency} back.`,
      keyboards.yesNo(),
    );
    return ctx.wizard.next();
  },
  async ctx => {
    const {withdraw, cancelWithdraw, user} = ctx.wizard.state;
    const chat = ctx.wizard.ctx.message.chat;

    if (!user.isAdmin || ctx.message.text !== keyboards.buttons.yes) {
      ctx.reply('Go back', keyboards.mainScreen(chat.id));
      return ctx.scene.leave();
    }

    // Process approve
    await cancelWithdraw(withdraw, chat);
    ctx.replyWithSticker('CAACAgIAAxkBAAEYSxZjKuso1ezo_nh2Juui2MqUyhgAAREAAlgRAAK-EShJHLQBkRXkDBApBA',
      keyboards.mainScreen(chat.id));

    return ctx.scene.leave();
  }
);

module.exports = withdrawDeclineScene;
