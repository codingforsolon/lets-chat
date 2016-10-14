//
// Rooms Controller
//

'use strict';

var settings = require('./../config').rooms,
    uuid = require('node-uuid'),
    _ = require('lodash');

module.exports = function() {
    var app = this.app,
        core = this.core,
        middlewares = this.middlewares,
        models = this.models,
        User = models.user;

    //
    // Routes
    //
    app.get('/rooms/new', middlewares.wechatAuth, function (req, res) {
        res.render('room/form.html');
    });
    app.post('/rooms/create', middlewares.wechatAuth, function (req, res) {
        console.log(req.body);
        var data = {
            owner: req.user,
            phone: req.param('phone'),
            name: req.param('name')
        };

        core.rooms.create(data, function(err, room) {
            if (err) {
                console.error(err);
                return res.status(400).json(err);
            }
            res.render('room/index.html', {
                room: room,
                user: req.user
            });
        });
    });
    app.get('/rooms/manage', middlewares.wechatAuth, function (req, res) {
        var user = req.user;
        console.log(user.name);
        core.rooms.findByOwner(user, function(err, room) {
            if (!room) {
                res.render('room/new.html');
            } else {
                core.topics.findByRoom({room: room}, function(err, topics) {
                    console.log(topics);
                    console.log(topics.length);
                    if (topics) {
                        res.render('room/index.html', {
                            room: room,
                            topics: topics,
                            user: req.user
                        });
                    } else {
                        res.render('room/index.html', {
                            room: room,
                            user: req.user
                        });
                    }
                });
            }
        });
    });
    app.route('/rooms/:room')
        .all(middlewares.wechatAuth, middlewares.roomRoute)
        .get(function(req, res) {
            var room = req.params.room;
            core.topics.findByRoom({room: room}, function(err, topics) {
                if (err) {
                    return res.status(400).json(err);
                }
                res.render('room/index.html', {
                    room: room,
                    topics: topics,
                    user: req.user
                });
            })
        })
        .post(function(req, res) {
            var room = req.params.room;
            if (!_.isEmpty(req.param('name').trim())) {
                room.name = req.param('name');
            }
            if (!_.isEmpty(req.param('description').trim())) {
                room.description = req.param('description');
            }
            room.save(function(err, room) {
                if (err) {
                    return res.status(400).json(err);
                }
                return res.json(room);
            });
        });
    app.route('/rooms/:room/setting')
        .all(middlewares.wechatAuth, middlewares.roomRoute)
        .get(function(req, res) {
            res.render('room/setting.html', {
                room: req.params.room
            });
        });
    app.route('/rooms/:room/setting/admins')
        .all(middlewares.wechatAuth, middlewares.roomRoute)
        .get(function(req, res) {
            res.render('room/admins.html', {
                admins: req.params.room.admins
            });
        });
    app.route('/rooms/:room/setting/admins/invite')
        .all(middlewares.wechatAuth, middlewares.roomRoute)
        .get(function(req, res) {
            var uid = uuid.v4();
            console.log(uid + '-' + _.now());
            console.log((new Date(_.now() + 1800000)));
            // res.render('room/admin_invite.html', {
            //     uid: uid
            // });
            res.json('ok');
        });
};
