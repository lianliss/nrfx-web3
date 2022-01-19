'use strict';
const os = require('os');
const process = require('process');
const express = require('express');
const config = require('./config/');
const path = require('path');
const nconf = require('nconf');
const morgan = require('morgan');
const consign = require('consign');
const compression = require('compression');
const uuid = require('uuid');
const cors = require('cors');
const jsyaml = require('js-yaml');
const swaggerTools = require('swagger-tools');
const fs = require('fs');
// const _ = require('lodash-es');
const helmet = require('helmet');
const logger = require('./utils/logger');
//const telegram = require('./services/telegram');
// const redis = require('./utils/redis');
const util = require('util');
// const SessionMiddleware = require('./utils/session');
const app = express();
const run = require('./controllers/run');
const {NODE_ENV, CONFIG_NAME = NODE_ENV, API_URL, STORAGE_BUCKET} = process.env;
const isLocal = process.env.NODE_ENV === 'local';

const router = require('./routes')(app);

// SessionMiddleware(app);
//redis.then(redisClient => app.set('redisClient', redisClient));

app.disable('etag');
app.nconf = nconf;

app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
}));  // only log error responses
// support json and url encoded requests
app.use(compression({ level: 9 }));

app.use(cors({origin: '*'}));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('port', config.server.port);

// consign(config.consign).include('routes').into(app);

app.use((req, res, next) => {
  const shopName = req.header('x-cpb-shop-name');
  if(shopName) req.session.shopName = shopName;
  
  res.locals.nonce = uuid.v4();
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  res.removeHeader('X-Frame-Options');
  next();
});
app.use(helmet({frameguard: false}));

const SERVER_PORT = app.get('port');

app.listen(SERVER_PORT, () => {
    if (!isLocal) {
        // telegram.launch();
        // telegram.log(`Server started on ${SERVER_PORT} ${NODE_ENV}`);
    }
    logger.info(`
    #### SERVER STARTED ON ${config.server.url}:${SERVER_PORT} ${NODE_ENV} ####
    `);

    run();
});

module.exports = app;
module.exports.nconf = nconf;
