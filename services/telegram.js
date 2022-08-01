const config = require('../config/');
const {Telegraf, Markup} = require('telegraf');
const logger = require('../utils/logger');
const {exec} = require('child_process');
const isLocal = process.env.NODE_ENV === 'local';
const _ = require('lodash');

let telegram;

if (isLocal) {
  telegram = {
    log: message => logger.debug('[Telegram local]', message),
  }
} else {

  telegram = new Telegraf(config.telegram.token);

  const serverKeyboard = Markup.inlineKeyboard([
    Markup.button.callback('Restart', 'restart'),
    Markup.button.callback('Pull', 'pull'),
  ]);

  const execOptions = {
    maxBuffer: 1024 * 1024 * 10,
  };

  const startCommand = ctx => {
    ctx.reply(`Test is ok ${Date.now()}`);
    ctx.telegram.sendMessage(ctx.message.chat.id, `id is ${ctx.message.chat.id}`);
  };

  const execute = (command, name, ctx) => new Promise((fulfill, reject) => {
    if (ctx.chat.id === config.telegram.chatId) {
      ctx.reply(`${name}...`);
      exec(command, (err, stdout, stderr) => {
        if (err) {
          logger.error('[telegram][execute]', command, err);
          ctx.reply(`Can't execute ${name}`);
          reject(`Can't execute ${name}`);
        } else {
          ctx.reply(stdout);
          fulfill(stdout);
        }
      });
    } else {
      ctx.reply(`You have no permission`);
      reject('You have no permission');
    }
  });

  const restartCommand = async ctx => {
    logger.debug('[Telegram][restartCommand]');
    await execute('pm2 restart web3', 'Restart', ctx);
    return;
  };

  const pullCommand = async ctx => {
    logger.debug('[Telegram][pullCommand]');
    await execute('cd /mnt/HC_Volume_15774891/Narfex_Project/WebDir/web3', 'Go to web3', ctx);
    await execute('git pull', 'Pull', ctx);
    await restartCommand(ctx);
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
        serverKeyboard)
    } else {
      ctx.reply(`You have no permission`);
    }
  });

  telegram.log = (message, isNotify = false) => {
    if (isLocal) return;
    telegram.telegram.sendMessage(
      config.telegram.chatId,
      message,
      {
        disable_notification: isNotify,
      }
    );
  };
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

process.once('unhandledRejection', (promise, reason) => {
  const message = _.get(reason, 'message', 'No message');
  logger.error('unhandledRejection', reason);
  telegram.log(`unhandledRejection reason: ${reason} ${message}`, true);
});

module.exports = telegram;
