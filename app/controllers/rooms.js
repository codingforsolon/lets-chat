//
// Rooms Controller
//

'use strict';

var settings = require('./../config').rooms;

module.exports = function() {
    var app = this.app,
        core = this.core,
        middlewares = this.middlewares,
        models = this.models,
        User = models.user;

    //
    // Routes
    //
    app.route('/rooms')
        .all(middlewares.wechatAuth)
        .get(function(req, res) {
            var user = req.session.wxUser;
            console.log(user);
            console.log(user.name);
            core.rooms.findByOwner(user.openId, function(err, room) {
                if (!room) {
                    res.render('room/new.html');
                } else {

                }
            });
        })
        .post(function(req, res) {
            console.log(req.body);

            var data = {
                owner: req.param('_id'),
                phone: req.param('phone'),
                name: req.param('name')
            };

            core.rooms.create(data, function(err, room) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                return res.status(201).json(room.toJSON());
            });
        });
};
