const {Markup} = require('telegraf');
const config = require('../../config/');

const buttons = {
  balance: '💼 Balance',
  pull: '🚧 Pull',
  restart: '♻️Restart',
  yes: '✅ Yes',
  no: '⛔️ No'
};

const mainScreen = chatID => {
  const keyboard = [
    [buttons.balance]
  ];

  if (chatID === config.telegram.chatId) {
    keyboard.push([
      buttons.restart, buttons.pull,
    ]);
  }

  return Markup.keyboard(keyboard).resize().oneTime();
};

const yesNo = () => {
  return Markup.keyboard([
    [buttons.no, buttons.yes],
  ]).resize().oneTime();
};

module.exports = {
  buttons,
  mainScreen,
  yesNo,
};