const config = require('../config');
const isLocal = process.env.NODE_ENV === 'local';
const mysql = isLocal
    ? require('mysql-ssh')
    : require('mysql');
//const telegram = require('../services/telegram');
const logger = require('../utils/logger');
const _ = require('lodash');
const timer = require('../utils/timeout');

class DataBase {

    constructor() {
        if (isLocal) {
            (async () => {
                try {
                    const mysqlConfig = require('../mysql.json');
                    logger.info('mysql', mysqlConfig);
                    this.connection = await mysql.connect(mysqlConfig.ssh, {
                        ...config.mysql,
                        ...mysqlConfig.db,
                    })
                } catch (error) {
                    logger.error('[DataBase] connect', error);
                }
            })();
        } else {
            this.connection = mysql.createConnection(config.mysql);
            this.connection.connect(error => {
                if (error) {
                    logger.error('[DataBase] connect', error.stack);
                    //telegram.log(`Database connection fail`);
                }
            });
        }
    }

    query(query) {
        return new Promise((fulfill, reject) => {
            if (this.connection) {
                this.connection.query(query, (error, results, fields) => {
                    if (error) {
                        logger.error('[DataBase] query', query, error.stack);
                        //telegram.log(`Database query error, ${query}`);
                        return reject(error);
                    }
                    fulfill(results, fields);
                })
            } else {
                timer(1000).then(() => {
                    logger.warn('[DataBase]', 'Connection still not ready...');
                    this.query(query).then(fulfill);
                })
            }
        })
    }

}

const db = new DataBase();

module.exports = db;
