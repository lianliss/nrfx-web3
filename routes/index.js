const express = require('express');
const router = express.Router();
const cors = require('cors');
const api = require('./api');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const config = require('../config');

module.exports = app => {

    const cors = {
        origin: [
            "http://localhost",
            "https://web3.narfex.com",
            "https://narfex.com",
            "https://cp.narfex.com",
            "https://testnet.narfex.com",
            "https://nrfxlab.world",
            "https://web3.nrfxlab.world",
        ],
        default: "https://web3.narfex.com",
    };

    app.all('*', function(req, res, next) {
        let origin = cors.default;
        cors.origin.map(domain => {
            if (domain === req.header('origin')) origin = domain;
        });
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", 'true');
        res.header("Access-Control-Allow-Headers", [
            'Origin',
            'X-Requested-With',
            'Content-Type',
            'Accept',
            'X-Token',
            'X-Beta',
            'X-APP-ID',
            'Accept-Language',
            'nrfx-sign',
            'nrfx-message',
        ].join(', '));
        next();
    });


    app.use(cookieParser());
    app.use(bodyParser.urlencoded(config.bodyParser));
    app.use(bodyParser.json(config.bodyParser));
    app.use(bodyParser.raw(config.bodyParser));
    app.use('/', router);
    router.use('/api/v1', api);
    router.use('/robots.txt', (req, res) => {
        res.type('text/plain');
        res.send("User-agent: *\nDisallow: /");
    });
    // router.get(/^\/(.*)/, (req, res) => {
    //     res.render("index", {serverUrl: config.server.url});
    // });
};
