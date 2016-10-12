'use strict';

var _ = require('lodash'),
    async = require('async'),
    cookieParser = require('cookie-parser'),
    mongoose = require('mongoose'),
    passport = require('passport'),
    passportSocketIo = require('passport.socketio'),
    BearerStrategy = require('passport-http-bearer'),
    BasicStrategy = require('passport-http').BasicStrategy,
    LocalStrategy = require('passport-local').Strategy,
    WechatStrategy = require('passport-wechat'),
    settings = require('./../config'),
    plugins = require('./../plugins');

var providerSettings = {},
    MAX_AUTH_DELAY_TIME = 24 * 60 * 60 * 1000,
    loginAttempts = {},
    enabledProviders = [];

function getProviders(core) {
    return settings.auth.providers.map(function(key) {
        var Provider;

        if (key === 'local') {
            Provider = require('./local');
        } else {
            Provider = plugins.getPlugin(key, 'auth');
        }

        return {
            key: key,
            provider: new Provider(settings.auth[key], core)
        };
    });
}

function setup(app, session, core) {

    enabledProviders = getProviders(core);

    enabledProviders.forEach(function(p) {
        p.provider.setup();
        providerSettings[p.key] = p.provider.options;
    });

    function tokenAuth(username, password, done) {
        if (!done) {
            done = password;
        }

        var User = mongoose.model('User');
        User.findByToken(username, function(err, user) {
            if (err) { return done(err); }
            if (!user) { return done(null, false); }
            return done(null, user);
        });
    }

    passport.use(new BearerStrategy(tokenAuth));
    passport.use(new BasicStrategy(tokenAuth));
    passport.use(new WechatStrategy({
            appID: settings.wechat.appId,
            appSecret: settings.wechat.appSecret,
            client: 'wechat',
            scope: 'snsapi_userinfo',
            state: 'STATE',
            // passReqToCallback: true,
            getToken: null,
            saveToken: null
        },
        function(accessToken, refreshToken, result, expires_in, done) {
            console.log(result);
            var User = mongoose.model('User');
            User.findByOpenId(result.openid, function(err, user) {
                console.log('---==-=-=-=-');
                console.log(user);
                if (err) {
                    return done(err, user);
                }
                if (!user) {
                    User.create({
                        openId: result.openid,
                        unionId: result.unionid,
                        name: result.nickname,
                        avatar: result.headimgurl,
                        sex: result.sex==1 ? 'M' : 'F'
                    }, function(err, u) {
                        // req.user = u.toObject();
                        return done(err, u);
                    });
                } else {
                    // req.user = user.toObject();
                    return done(null, user);
                }
            });
        }
    ));
    passport.use(new LocalStrategy(
        function(username, password, done) {
            console.log('local auth');
            var User = mongoose.model('User');

            // if (username == 'a') {
            //     User.findOne({name: 'a'}, function(err, user) {
            //         console.log('user is a:');
            //         console.log(user);
            //         if (!user) {
            //             User.create({
            //                 name: 'a',
            //                 openId: 'aaa',
            //                 phone: 'aaa',
            //                 email: 'aaa@163.com',
            //                 avatar: 'http://b.hiphotos.baidu.com/image/pic/item/a686c9177f3e670900d880193fc79f3df9dc5578.jpg'
            //             }, function(err, u) {
            //                 console.log(err);
            //                 console.log(u);
            //                 console.log('create success');
            //             });
            //         }
            //     });
            // }
            // if (username == 'b') {
            //     User.findOne({name: 'b'}, function(err, user) {
            //         if (!user) {
            //             User.create({
            //                 name: 'b',
            //                 openId: 'bbb',
            //                 phone: 'bbb',
            //                 email: 'bbb@163.com',
            //                 avatar: 'http://h.hiphotos.baidu.com/image/pic/item/a2cc7cd98d1001e9460fd63bbd0e7bec54e797d7.jpg'
            //             });
            //         }
            //     });
            // }

            User.findOne({ name: username }, function (err, user) {
                if (err) { return done(err); }
                if (!user) {
                    return done(null, false, { message: 'Incorrect username.' });
                }
                console.log(user);
                return done(null, user);
            });
        }
    ));

    passport.serializeUser(function(user, done) {
        done(null, user._id);
    });

    passport.deserializeUser(function(id, done) {
        var User = mongoose.model('User');
        User.findOne({ _id: id }, function(err, user) {
            done(err, user);
        });
    });

    app.use(passport.initialize());
    app.use(passport.session());

    session = _.extend(session, {
        cookieParser: cookieParser,
        passport: passport
    });

    var psiAuth = passportSocketIo.authorize(session);

    app.io.use(function (socket, next) {
        var User = mongoose.model('User');
        if (socket.request._query && socket.request._query.token) {
            User.findByToken(socket.request._query.token, function(err, user) {
                if (err || !user) {
                    return next('Fail');
                }

                socket.request.user = user;
                socket.request.user.loggedIn = true;
                socket.request.user.usingToken = true;
                next();
            });
        } else {
            psiAuth(socket, next);
        }

    });
}

function checkIfAccountLocked(username, cb) {
    var attempt = loginAttempts[username];
    var isLocked = attempt &&
                   attempt.lockedUntil &&
                   attempt.lockedUntil > Date.now();

    cb(isLocked);
}

function wrapAuthCallback(username, cb) {
    return function(err, user, info) {
        if (!err && !user) {

            if(!loginAttempts[username]) {
                loginAttempts[username] = {
                    attempts: 0,
                    lockedUntil: null
                };
            }

            var attempt = loginAttempts[username];

            attempt.attempts++;

            if (attempt.attempts >= settings.auth.throttling.threshold) {
                var lock = Math.min(5000 * Math.pow(2, (attempt.attempts - settings.auth.throttling.threshold), MAX_AUTH_DELAY_TIME));
                attempt.lockedUntil = Date.now() + lock;
                return cb(err, user, {
                    locked: true,
                    message: 'Account is locked.'
                });
            }

            return cb(err, user, info);

        } else {

            if(loginAttempts[username]) {
                delete loginAttempts[username];
            }
            cb(err, user, info);
        }
    };
}

function authenticate() {
    var req, username, cb;

    if (arguments.length === 4) {
        username = arguments[1];

    } else if (arguments.length === 3) {
        username = arguments[0];

    } else {
        username = arguments[0].body.username;
    }

    username = username.toLowerCase();

    if (arguments.length === 4) {
        req = _.extend({}, arguments[0], {
            body: {
                username: username,
                password: arguments[2]
            }
        });
        cb = arguments[3];

    } else if (arguments.length === 3) {
        req = {
            body: {
                username: username,
                password: arguments[1]
            }
        };
        cb = arguments[2];

    } else {
        req = _.extend({}, arguments[0]);
        req.body.username = username;
        cb = arguments[1];
    }

    checkIfAccountLocked(username, function(locked) {
        if (locked) {
            return cb(null, null, {
                locked: true,
                message: 'Account is locked.'
            });
        }

        if (settings.auth.throttling &&
            settings.auth.throttling.enable) {
            cb = wrapAuthCallback(username, cb);
        }

        var series = enabledProviders.map(function(p) {
            var provider = p.provider;
            return function() {
                var args = Array.prototype.slice.call(arguments);
                var callback = args.slice(args.length - 1)[0];

                if (args.length > 1 && args[0]) {
                    return callback(null, args[0]);
                }

                provider.authenticate(req, function(err, user) {
                    if (err) {
                        return callback(err);
                    }
                    return callback(null, user);
                });
            };
        });

        async.waterfall(series, function(err, user) {
            cb(err, user);
        });
    });
}

module.exports = {
    setup: setup,
    authenticate: authenticate,
    providers: providerSettings
};
