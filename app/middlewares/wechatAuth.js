'use strict';

var OAuth = require('wechat-oauth'),
    settings = require('./../config'),
    mongoose = require('mongoose'),
    passport = require('passport');

function getMiddleware() {
    return function(req, res, next) {
        console.log('start to oauth======>');
        console.log(req.user);
        req.user = null;
        if (req.user) {
            next();
        } else {
            console.log('start local auth');
            var auth = passport.authenticate('local');
            return auth(req, res, next);

            // var auth = passport.authenticate('wechat');
            // return auth(req, res, next);


            // var client = new OAuth(settings.wechat.appId, settings.wechat.appSecret);
            // if (req.query.code) {
            //     console.log('code: ' + req.query.code);
            //     client.getUserByCode(req.query.code, function(err, result) {
            //         console.log('<------ Wx User Info ------>');
            //         console.log(result);
            //         var User = mongoose.model('User');
            //         User.findByOpenId(result.openid, function(err, user) {
            //             if (err) {
            //                 return res.sendStatus(400);
            //             }
            //             if (!user) {
            //                 User.create({
            //                     openId: result.openid,
            //                     unionId: result.unionid,
            //                     name: result.nickname,
            //                     avatar: result.headimgurl,
            //                     sex: result.sex==1 ? 'M' : 'F'
            //                 }, function(err, u) {
            //                     if (err) {
            //                         return res.sendStatus(400);
            //                     }
            //                     req.session.wxUser = u.toObject();
            //                     next();
            //                 });
            //             } else {
            //                 req.session.wxUser = user.toObject();
            //                 next();
            //             }
            //         });
            //     });
            // } else {
            //     var url = client.getAuthorizeURL(settings.wechat.domain + req.originalUrl, 'state', null);
            //     // var url = client.getAuthorizeURLForWebsite(req.originalUrl);
            //     console.log(url);
            //     // res.location(url);
            //     return res.redirect(302, url);
            // }
        }
    };
}

module.exports = getMiddleware();

