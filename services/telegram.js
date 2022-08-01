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
    Markup.button.callback('Update', 'update'),
    Markup.button.callback('Rebuild', 'build'),
    Markup.button.callback('Update Frond', 'updatefront'),
  ]);

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
  const restartCommand = ctx => {
    if (ctx.chat.id === config.telegram.chatId) {
      ctx.reply(`Restarting...`);
      exec('pm2 restart ai', (err, stdout, stderr) => {
        if (err) {
          logger.error('[telegram][restartCommand]', err);
          ctx.reply(`Can't execute restartCommand`);
        }
      });
    } else {
      ctx.reply(`You have no permission to restart`);
    }
  };
  const pullCommand = ctx => {
    if (ctx.chat.id === config.telegram.chatId) {
      ctx.reply(`Git pull...`);
      exec('git pull', (err, stdout, stderr) => {
        if (err) {
          logger.error('[telegram][pullCommand]', err);
          ctx.reply(`Can't execute pullCommand`);
        } else {
          ctx.reply(stdout);
          restartCommand(ctx);
        }
      });
    } else {
      ctx.reply(`You have no permission`);
    }
  };
  const updateCommand = ctx => {
    if (ctx.chat.id === config.telegram.chatId) {
      ctx.reply(`Installing nodes...`);
      exec('git pull', (err, stdout, stderr) => {
        if (err) {
          logger.error('[telegram][pullCommand]', err);
          ctx.reply(`Can't execute pullCommand`);
        } else {
          ctx.reply(stdout);
          exec('npm run reset', execOptions, (err, stdout, stderr) => {
            if (err) {
              logger.error('[telegram][updateCommand]', err);
              ctx.reply(`Can't execute updateCommand`);
            } else {
              ctx.reply(`node_modules updated`);
              restartCommand(ctx);
            }
          });
        }
      });
    } else {
      ctx.reply(`You have no permission`);
    }
  };
  const updateFrontCommand = ctx => {
    if (ctx.chat.id === config.telegram.chatId) {
      ctx.reply(`Updating front...`);
      exec('git pull', frontExecOptions, (err, stdout, stderr) => {
        if (err) {
          logger.error('[telegram][updateFrontCommand]', err);
          ctx.reply(`Can't execute updateFrontCommand`);
        } else {
          ctx.reply(stdout);
          exec('npm run reset', frontExecOptions, (err, stdout, stderr) => {
            if (err) {
              logger.error('[telegram][updateFrontCommand]', err);
              ctx.reply(`Can't execute updateFrontCommand [reset]`);
            } else {
              ctx.reply('Front modules updated.');
              exec('npm run build', frontExecOptions, (err, stdout, stderr) => {
                if (err) {
                  logger.error('[telegram][updateFrontCommand]', err);
                  ctx.reply(`Can't execute updateFrontCommand [build]`);
                } else {
                  ctx.reply('Scripts rebulded.');
                }
              });
            }
          })
        }
      });
    } else {
      ctx.reply(`You have no permission`);
    }
  };
  const buildFrontCommand = ctx => {
    if (ctx.chat.id === config.telegram.chatId) {
      ctx.reply(`Rebuilding front...`);
      exec('git pull', frontExecOptions, (err, stdout, stderr) => {
        if (err) {
          logger.error('[telegram][buildFrontCommand]', err);
          ctx.reply(`Can't execute buildFrontCommand`);
        } else {
          ctx.reply(stdout);
          exec('npm run build', frontExecOptions, (err, stdout, stderr) => {
            if (err) {
              logger.error('[telegram][buildFrontCommand]', err);
              ctx.reply(`Can't execute buildFrontCommand`);
            } else {
              ctx.reply('Front scripts rebuilded.');
            }
          })
        }
      });
    } else {
      ctx.reply(`You have no permission`);
    }
  };

  telegram.command('start', startCommand);
  telegram.command('restart', restartCommand);
  telegram.command('pull', pullCommand);
  telegram.command('update', updateCommand);
  telegram.command('build', buildFrontCommand);
  telegram.command('updatefront', updateFrontCommand);

  telegram.action('restart', restartCommand);
  telegram.action('pull', pullCommand);
  telegram.action('update', updateCommand);
  telegram.action('build', buildFrontCommand);
  telegram.action('updatefront', updateFrontCommand);

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
