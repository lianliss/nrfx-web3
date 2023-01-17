const {Scenes, Markup} = require('telegraf');
const logger = require('../../utils/logger');
const _ = require('lodash');
const db = require('../../models/db');
const keyboards = require('./keyboards');

const cardReviewScene = new Scenes.WizardScene(
  'CARD_REVIEW_SCENE_ID',
  ctx => {
    const {operation, user} = ctx.wizard.state;
    if (user.isAdmin) {
      ctx.reply(
        `Are you sure to approve?`,
        keyboards.yesNo(),
      );
    } else {
      ctx.reply(
        `How many ${operation.currency.toUpperCase()} did you receive?`,
      );
    }
    return ctx.wizard.next();
  },
  async ctx => {
    const {operation, approveTopup, user, log} = ctx.wizard.state;
    const chat = ctx.wizard.ctx.message.chat;
    const amount = Number(ctx.message.text);
    if (amount !== operation.amount && !user.isAdmin) {
      if (operation.status === 'wait_for_admin_review') {
        return ctx.reply(
          `Nah. It's wrong again 🙄`,
        );
      }
      ctx.reply(
        'Wrong amount. Sent to admin for review. But you can try again. 🙃',
      );

      // Mark operation as pending admin review
      const data = await Promise.all([
        db.sendToAdminReview(operation.id, operation.account_address),
        db.getOperationAdminMessages(operation.id)
      ]);
      const messages = data[1];

      // Update messages for admins
      messages.map(async message => {
        try {
          // Try to delete old message from the chat
          try {
            await ctx.telegram.deleteMessage(message.chatID, message.messageID);
          } catch (error) {
            logger.warn('[Telegram][cardReviewScene]', 'No message for delete', message.chatID, ':', message.messageID);
          }

          // Delete message from db
          db.deleteMessage(message.id);

          // Add a new message with warning sign
          const newMessage = await ctx.telegram.sendMessage(
            message.chatID,
            `<b>⚠️ Operation is pending admin review #${operation.id}</b>\n${operation.account_address}\n`
            + `<b>Network:</b> ${operation.networkID}\n`
            + `<b>Card:</b> ${operation.number}\n<b>Holder:</b> ${operation.holder_name}\n<b>Manager: </b>`
            + (operation.telegram_id
            ? `<a href="tg://user?id=${operation.telegram_id}">${operation.first_name || ''} ${operation.last_name || ''}</a>`
            : `${operation.first_name || ''} ${operation.last_name || ''}`)
            + `\n<b>Amount:</b> ${operation.amount} ${operation.currency}`,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                Markup.button.callback('Decline', `decline_card_operation_${operation.id}`),
                Markup.button.callback('Approve', `approve_card_operation_${operation.id}`),
              ]),
            },
          );
          db.putOperationMessage(operation.id, message.chatID, newMessage.message_id);
        } catch (error) {
          logger.error('[Telegram][cardReviewScene]', error);
        }
      });
      // Mark operation status as pending for admin review in the Scene state
      operation.status = 'wait_for_admin_review';
      return;
    } else {
      if (user.isAdmin && ctx.message.text !== keyboards.buttons.yes) {
        ctx.reply('Go back', keyboards.mainScreen(chat.id));
        return ctx.scene.leave();
      }
    }

    // Process approve
    try {
      await approveTopup(operation.id, chat);
    } catch (error) {
      log(`[cardReviewScene][approveTopup] #${operation.id} Error [${error.code}] ${error.message}`);
      ctx.reply(
        `Approve #${operation.id} error: ${error.message}\n`
        + `<b>Please call the admin</b>`,
        keyboards.mainScreen(chat.id),
      );
      return ctx.scene.leave();
    }
    
    ctx.replyWithSticker(
      'CAACAgIAAxkBAAEX7kRjG6QnFI2D7U7W5h8so-zrcb56fAACoBAAAuVXMEkM1tp3XgcpHikE',
      keyboards.mainScreen(chat.id),
    );

    return ctx.scene.leave();
  }
  );

module.exports = cardReviewScene;
