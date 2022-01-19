'use strict';
const
  /**
   * App Config
   * @type {{develop: {AppConfig} stage: {AppConfig} production:{AppConfig}}|*}
   */
  config = require('../config'),
  /**
   * Express Session
   * @type {session}
   */
  session = require('express-session'),
  /**
   * Redis Session Store
   * @type {Function|RedisStore}
   */
  RedisStore = require('connect-redis')(session),
  /**
   * @namespace SessionMiddleware
   * @param app
   * @returns {*}
   * @constructor
   */
  SessionMiddleware = app => {
    /**
     * checks request for the session presence
     * @param {Request} req
     * @param {Response} res
     * @param {function} next
     * @returns {TypeError|function}
     */
    function checkSession(req, res, next) {
      if(!req.session) next(new Error(`[SessionMiddleware][checkSession] lost session`));
      next();
    }
    /**
     * attaches redis session middleware (ideally it should work in multi-server setup)
     * @function session
     */
    app.use(session({
      cookie: {maxAge: 600000},
      resave: false,
      saveUninitialized: true,
      secret: 'attaching redis session middleware (ideally it should work in multi-server setup)666',
      store: new RedisStore( {
        db: 1,
        url: config.redis.url,
        prefix: config.environment,
        disableTTL: true,
        logErrors: true,
      })
    }));
    app.use(checkSession);
    return app;
  };
module.exports = SessionMiddleware;
