const {Scenes, Markup} = require('telegraf');
const logger = require('../../utils/logger');
const _ = require('lodash');
const db = require('../../models/db');
const keyboards = require('./keyboards');

const withdrawApproveScene = new Scenes.WizardScene(
  'WITHDRAW_CONFIRM_SCENE_ID',
  ctx => {
    ctx.reply(
      `Have you already sent money to the client's account?`,
      keyboards.yesNo(),
    );
    return ctx.wizard.next();
  },
  async ctx => {
    const {withdraw, confirmWithdraw, user} = ctx.wizard.state;
    try {
      const chat = _.get(ctx, 'wizard.ctx.message.chat', _.get(ctx, 'message.chat'));
  
      if (!user.isAdmin || ctx.message.text !== keyboards.buttons.yes) {
        ctx.reply('Go back', keyboards.mainScreen(chat.id));
        return ctx.scene.leave();
      }
  
      // Process approve
      await confirmWithdraw(withdraw, chat);
      ctx.replyWithSticker('CAACAgIAAxkBAAEX7kRjG6QnFI2D7U7W5h8so-zrcb56fAACoBAAAuVXMEkM1tp3XgcpHikE',
        keyboards.mainScreen(chat.id));
    } catch (error) {
      logger.error('[Telegram][withdrawApproveScene]', withdraw.id, error, ctx);
      ctx.telegram.log(`[withdrawApproveScene] ${withdraw.id} Error: ${error.message}`);
    }

    return ctx.scene.leave();
  }
);

module.exports = withdrawApproveScene;
