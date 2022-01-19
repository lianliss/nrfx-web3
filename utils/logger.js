const log4js = require('log4js');
const config = require('../config/');

/**
 * Possible values for the levels are:
 * ALL
 * TRACE
 * DEBUG
 * INFO
 * WARN
 * ERROR
 * FATAL
 * OFF
 */

const loggerConfig = {
    appenders: {
        // dev: { type: 'stdout' },
        // app: { type: 'file', filename: 'app.log' },
        // slack: {
        //   type: 'slack',
        //   token: config.slack.apiToken,
        //   channel_id: 'cpb-logs',
        //   username: 'cpb-logs-sender',
        // },
        file: {
            type: 'file',
            filename: './tmp/app.log',
            layout: {
                type: 'pattern',
                pattern: '%d{dd.MM/hh:mm} %[%p%] - %m'
            }
        },
        stdout: {
            type: 'stdout',
            layout: {
                type: 'pattern',
                // pattern: '%d %[%p%] - %m', // pattern with date
                pattern: '%[%p%] - %m', // pattern without date
            }
        }
    },
    categories: {
        default: {
            appenders: [ 'file', 'stdout' ],
            level: config.logger.level
        }
    },
};

log4js.configure(loggerConfig);

const logger = log4js.getLogger();

module.exports = logger;
