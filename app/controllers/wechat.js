//
// Account Controller
//

'use strict';

var _ = require('lodash'),
    settings = require('./../config'),
    wechat = require('wechat');

module.exports = function() {

    var app = this.app,
        core = this.core,
        middlewares = this.middlewares;

    console.log(settings.wechat);

    var config = {
        appid: settings.wechat.appId,
        token: settings.wechat.token,
        encodingAESKey: settings.wechat.aesKey
    };
    console.log('---before wechat');

    //
    // Routes
    //
    app.use('/wechat', wechat(config, function(req, res, next) {
        var message = req.weixin;
        console.log(message);
        if (message.Event === 'subscribe') {
            console.log('subscribe now');
        } else if (message.Event === 'unsubscribe') {
            console.log('it`s unsubscribe');
        }
    }));
};
