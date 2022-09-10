const config = require('../../config/');
const {Telegraf, Markup, Extra, Scenes, session} = require('telegraf');
const logger = require('../../utils/logger');
const {exec} = require('child_process');
const isLocal = false && process.env.NODE_ENV === 'local';
const _ = require('lodash');
const cardReviewScene = require('./cardReviewScene');
const invoiceReviewScene = require('./invoiceReviewScene');
const UserModel = require('../../models/user');
const db = require('../../models/db');
const keyboards = require('./keyboards');

let telegram;

if (isLocal) {
  telegram = {
    log: message => logger.debug('[Telegram local]', message),
  }
} else {

  telegram = new Telegraf(config.telegram.token);
  telegram.narfexLogic = {};
  const bot = telegram;

  telegram.launch();

  const serverKeyboard = Markup.inlineKeyboard([
    Markup.button.callback('Restart', 'restart'),
    Markup.button.callback('Pull', 'pull'),
    Markup.button.callback('Update', 'update'),
    Markup.button.callback('Rebuild', 'build'),
    Markup.button.callback('Update Frond', 'updatefront'),
  ]);

  const testKeyboard = Markup.keyboard([
    [
      '1', '2', '3',
    ],
    [
      'Да ну нахуй',
    ]
  ]).placeholder('Заебись?').oneTime();

  const execOptions = {
    maxBuffer: 1024 * 1024 * 10,
  };

  const frontExecOptions = {
    ...execOptions,
    cwd: '/root/bot-ui',
  };

  const startCommand = ctx => {
    ctx.reply(`Test is ok ${Date.now()}`);
    ctx.telegram.sendMessage(ctx.message.chat.id, `id is ${ctx.message.chat.id}`);
  };

  const execute = (command, name, ctx) => new Promise((fulfill, reject) => {
    try {
      if (ctx.chat.id === config.telegram.chatId) {
        ctx.reply(`${name}...`);
        exec(command, (err, stdout, stderr) => {
          if (err) {
            logger.error('[telegram][execute]', command, err);
            ctx.reply(`Can't execute ${name}`);
            reject(`Can't execute ${name}`);
          } else {
            if (stdout && stdout.length) {
              ctx.reply(stdout);
            }
            fulfill(stdout);
          }
        });
      } else {
        ctx.reply(`You have no permission`);
        reject('You have no permission');
      }
    } catch (error) {
      logger.error('[Telegram][execute]', name, error);
      telegram.log(`[execute] ${name} Error: ${error.message}`);
      reject(error.message);
    }
  });

  const restartCommand = async ctx => {
    await execute('pm2 restart web3', 'Restart', ctx);

  };

  const pullCommand = async ctx => {
    await execute(config.telegram.cdCommand, 'Go to web3', ctx);
    await execute('git pull', 'Pull', ctx);
    restartCommand(ctx);
  };

  telegram.command('start', startCommand);
  telegram.command('restart', restartCommand);
  telegram.command('pull', pullCommand);

  telegram.action('restart', restartCommand);
  telegram.action('pull', pullCommand);

  telegram.help((ctx) => {
    if (ctx.message.chat.id === config.telegram.chatId) {
      ctx.telegram.sendMessage(
        ctx.from.id,
        'There is a commands',
        testKeyboard)
    } else {
      ctx.reply(`You have no permission`);
    }
  });

  telegram.log = (message, isNotify = false) => {
    if (isLocal) return;
    try {
      telegram.telegram.sendMessage(
        config.telegram.chatId,
        message,
        {
          parse_mode: 'HTML',
          disable_notification: isNotify,
          disable_web_page_preview: false,
        }
      );
    } catch (error) {
      logger.error(`[telegram] Can't send message`, config.telegram.chatId, message);
    }
  };

  const stage = new Scenes.Stage([cardReviewScene, invoiceReviewScene]);
  telegram.use(session());
  telegram.use(stage.middleware());

  telegram.sendCardOperation = async (user, operation) => {
    if (!user.telegramID) return;
    try {
      const message = await telegram.telegram.sendMessage(
        user.telegramID,
        user.isAdmin
          ? `<b>New topup operation #${operation.id}</b>\n<code>${operation.account_address}</code>\n`
          + `<b>Card:</b> ${operation.number}\n<b>Holder:</b> ${operation.holder_name}\n<b>Manager: </b>`
          + (operation.telegram_id
            ? `<a href="tg://user?id=${operation.telegram_id}">${operation.first_name || ''} ${operation.last_name || ''}</a>`
            : `${operation.first_name || ''} ${operation.last_name || ''}`)
          + `\n<b>Amount:</b> ${operation.amount} ${operation.currency}`
          : `<b>New topup operation #${operation.id}</b>\n<code>${operation.account_address}</code>\n`
          + `<b>Card:</b> ${operation.number}\n<b>Holder:</b> ${operation.holder_name}\n`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            Markup.button.callback('Decline', `decline_card_operation_${operation.id}`),
            Markup.button.callback('Approve', `approve_card_operation_${operation.id}`),
          ])
        });
      await db.putOperationMessage(operation.id, user.telegramID, message.message_id);
    } catch (error) {
      logger.error('[Telegram][sendCardOperation]', user.telegramID, error);
    }
  };

  telegram.action(/^approve_card_operation_(\d+)$/, async ctx => {
    try {
      const operationID = ctx.match[1];
      const message = ctx.callbackQuery.message;
      const telegramID = message.chat.id;
      const data = await Promise.all([
        UserModel.getByTelegramID(telegramID),
        db.getReservationById(operationID),
      ]);
      const user = data[0];
      const operation = data[1][0];

      if (!user || !(user.isAdmin || operation.managed_by === user.userID)) {
        return ctx.reply(`You don't have permissions for that operation`);
      }
      if (!operation
        || !_.includes(['wait_for_review', 'wait_for_admin_review'], operation.status)) {
        return ctx.reply(`Operation is not under review`);
      }

      ctx.scene.enter('CARD_REVIEW_SCENE_ID', {
        operationID,
        operation,
        user,
        approveTopup: telegram.narfexLogic.approveTopup,
      });
    } catch (error) {
      logger.error('[Telegram] Action', ctx, error);
      telegram.log(`Action error approve_card_operation ${error.message}`);
    }
  });

  telegram.sendInvoice = async (user, invoice) => {
    if (!user.telegramID) return;
    try {
      const message = await telegram.telegram.sendMessage(
        user.telegramID,
        `New SWIFT invoice #<code>${invoice.id}</code>\n`
        + `<code>${invoice.accountAddress}</code>\n`
        + `<b>Buyer:</b> ${invoice.name || ''} ${invoice.lastName || ''}\n`
        + `<b>Phone:</b> ${invoice.phone || ''}\n`
        + `<b>Amount:</b> ${invoice.amount.toFixed(2)} USDT`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            Markup.button.callback('Decline', `decline_invoice_${invoice.id}`),
            Markup.button.callback('Approve', `approve_invoice_${invoice.id}`),
          ])
        });
      await db.putInvoiceMessage(invoice.id, user.telegramID, message.message_id);
    } catch (error) {
      logger.error('[Telegram][sendInvoice]', user.telegramID, error);
    }
  };

  telegram.action(/^approve_invoice_(\d+)$/, async ctx => {
    try {
      const invoiceID = ctx.match[1];
      const message = ctx.callbackQuery.message;
      const telegramID = message.chat.id;
      const data = await Promise.all([
        UserModel.getByTelegramID(telegramID),
        db.getInvoiceById(invoiceID),
      ]);
      const user = data[0];
      const invoice = data[1][0];
      ctx.reply(`TRY TO APPOVE INVOICE ${invoiceID} ${invoice.id}`);

      if (!user || !user.isAdmin) {
        return ctx.reply(`You don't have permissions for that operation`);
      }
      if (!invoice
        || !_.includes(['wait_for_review', 'wait_for_admin_review'], invoice.status)) {
        return ctx.reply(`Invoice is not under review`);
      }

      ctx.scene.enter('INVOICE_REVIEW_SCENE_ID', {
        invoiceID,
        invoice,
        user,
        approveInvoice: telegram.narfexLogic.approveInvoice,
      });
    } catch (error) {
      logger.error('[Telegram] Action', ctx, error);
      telegram.log(`Action error approve_invoice ${error.message}`);
    }
  });

  telegram.command('menu', ctx => {
    ctx.replyWithSticker('CAACAgIAAxkBAAEX9PNjHPUBaeZbpNcDFZMJwd_tpwu4MgACNwwAAiHRMUlAzx0V3wssFSkE',
      {
        parse_mode: 'HTML',
        ...keyboards.mainScreen(ctx.chat.id),
      });
  });

  telegram.hears(keyboards.buttons.balance, async ctx => {
    ctx.telegram.sendChatAction(ctx.message.chat.id, 'typing');
    const balance = await telegram.narfexLogic.getBinanceBalance();
    ctx.reply(
      `<b>Binance</b> (BEP20)\n`
      + `<code>${config.binance.address}</code>\n`
      + `${balance.usdt.toFixed(2)} USDT\n\n`
      + `<b>Wallet</b> (BEP20)\n`
      + `<code>${config.web3.defaultAddress}</code>\n`
      + `${balance.bnb.toFixed(4)} BNB\n`
      + `${balance.nrfx.toFixed()} NRFX`,
      {
        parse_mode: 'HTML',
      })
  });

  telegram.hears(keyboards.buttons.pull, pullCommand);
  telegram.hears(keyboards.buttons.restart, restartCommand);
}



['SIGINT', 'SIGTERM', 'SIGHUP'].map(reason => {
  process.once(reason, reason => {
    logger.info('Process stop', reason);
    if (!isLocal) {
      telegram.log(`Server stopped ${reason}`);
      telegram.stop(reason);
    }
    setTimeout(() => {
      process.exit();
    }, 10)
  });
});

process.once('unhandledRejection', (reason, promise) => {
  const code = _.get(reason, 'code', 'No code');
  const message = _.get(reason, 'message', 'No message');
  logger.error('unhandledRejection', reason, promise);
  telegram.log(`unhandledRejection reason: [${code}] ${message}`, true);
});

module.exports = telegram;
