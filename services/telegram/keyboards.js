const {Markup} = require('telegraf');
const config = require('../../config/');

const buttons = {
  balance: '💼 Balance',
  pull: '🚧 Pull'
};

const mainScreen = chatID => {
  const keyboard = [
    [buttons.balance]
  ];

  if (chatID === config.telegram.chatId) {
    keyboard.push([
      buttons.pull,
    ]);
  }

  return Markup.keyboard(keyboard).resize().oneTime()
};

module.exports = {
  buttons,
  mainScreen,
};