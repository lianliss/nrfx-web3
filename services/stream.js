const _ = require('lodash');
const logger = require('../utils/logger');
const WebSocketServer = require('websocket').server;
const http = require('http');
const {auth} = require('../controllers/auth');

const server = http.createServer((request, response) => {
    logger.debug((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(3009, () => {
    logger.info('Websocket is listening on port 3009');
});

const streamServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: true
});

const originIsAllowed = origin => {
    // TODO add origins
    return true;
};

streamServer.on('request', request => {
    // if (!originIsAllowed(request.origin)) {
    //     // Make sure we only accept requests from an allowed origin
    //     request.reject();
    //     logger.warn('Connection from origin ' + request.origin + ' rejected.');
    //     return;
    // }
    logger.debug('streamServer request', request);
    try {
        const connection = request.accept('echo-protocol', request.origin);
        logger.debug('[streamServer] Connection accepted');
        connection.on('message', message => {
          if (message.type === 'utf8') {
            logger.debug('Received Message: ' + message.utf8Data);
            
            switch (_.get(message, 'utf8Data', '').toLowerCase()) {
              case 'ping':
                connection.sendUTF('PONG');
                break;
              default:
                connection.sendUTF(message.utf8Data);
            }
          } else if (message.type === 'binary') {
            logger.debug('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
          }
        });
        connection.on('close', (reasonCode, description) => {
          logger.debug('[streamServer] Disconnected stream', reasonCode, description);
        });
    } catch(error) {
        logger.error('[streamServer] on request', error);
    }

    return;
    auth(request, undefined, undefined, user => {
        try {
            const connection = request.accept('echo-protocol', request.origin);
            logger.debug('[streamServer] Connection accepted for user', user.login);
            connection.on('message', message => {
                if (message.type === 'utf8') {
                    logger.debug('Received Message: ' + message.utf8Data);

                    switch (_.get(message, 'utf8Data', '').toLowerCase()) {
                        case 'ping':
                            connection.sendUTF('PONG');
                            break;
                        default:
                            connection.sendUTF(message.utf8Data);
                    }
                }
                else if (message.type === 'binary') {
                    logger.debug('Received Binary Message of ' + message.binaryData.length + ' bytes');
                    connection.sendBytes(message.binaryData);
                }
            });
            connection.on('close', (reasonCode, description) => {
                logger.debug('[streamServer] Disconnected stream for', user.login, reasonCode, description);
            });
            user.streams.push(connection);
        } catch(error) {
            logger.error('[streamServer] on request', error);
        }
    });
});