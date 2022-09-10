const {Scenes, Markup} = require('telegraf');
const logger = require('../../utils/logger');
const _ = require('lodash');
const db = require('../../models/db');

const cardDeclineScene = new Scenes.WizardScene(
  'CARD_DECLINE_SCENE_ID',
  ctx => {
    const {operation, user} = ctx.wizard.state;
    ctx.reply(
      `Are you sure you want to decline the operation? 🤨`,
      Markup.keyboard([
        ['No', 'Yes']
      ]).resize().oneTime(),
    );
    return ctx.scene.leave();
  },
  async ctx => {

  },
);

module.exports = cardDeclineScene;
