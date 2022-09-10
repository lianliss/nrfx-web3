const {Markup} = require('telegraf');

const buttons = {
  balance: '💼 Balance',
};

const mainScreen = Markup.keyboard([
  [buttons.balance]
]).resize().oneTime();

module.exports = {
  buttons,
  mainScreen,
};