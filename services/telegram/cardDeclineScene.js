const {Scenes, Markup} = require('telegraf');
const logger = require('../../utils/logger');
const _ = require('lodash');
const db = require('../../models/db');
const keyboards = require('./keyboards');

const cardDeclineScene = new Scenes.WizardScene(
  'CARD_DECLINE_SCENE_ID',
  ctx => {
    const {operation, user} = ctx.wizard.state;
    ctx.reply(
      `Are you sure you want to decline the operation? 🤨`,
      keyboards.yesNo(),
    );
    return ctx.scene.next();
  },
  async ctx => {
    const {operation, cancelTopup, user, log} = ctx.wizard.state;
    const chat = _.get(ctx, 'wizard.ctx.message.chat', _.get(ctx, 'update.callback_query.from'));
    
    if (!user.isAdmin || ctx.message.text !== keyboards.buttons.yes) {
      ctx.reply('Go back', keyboards.mainScreen(chat.id));
      return ctx.scene.leave();
    }
    
    // Process approve
    try {
      await cancelTopup(operation.id, chat);
    } catch (error) {
      log(`[cardReviewScene][cancelTopup] #${operation.id} Error [${error.code}] ${error.message}`);
      ctx.reply(
        `Approve #${operation.id} error: ${error.message}\n`
        + `<b>Please call the admin</b>`,
        keyboards.mainScreen(chat.id),
      );
      return ctx.scene.leave();
    }
  
    ctx.replyWithSticker('CAACAgIAAxkBAAEYSxZjKuso1ezo_nh2Juui2MqUyhgAAREAAlgRAAK-EShJHLQBkRXkDBApBA',
      keyboards.mainScreen(chat.id));
    
    return ctx.scene.leave();
  }
);

module.exports = cardDeclineScene;
