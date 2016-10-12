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
            var user = req.user;
            console.log(user.name);
            core.rooms.findByOwner(user, function(err, room) {
                if (!room) {
                    if (req.query.type == 'create') {
                        res.render('room/form.html');
                    } else {
                        res.render('room/new.html');
                    }
                } else {
                    res.render('room/index.html', {
                        roomId: room._id
                    });
                }
            });
        })
        .post(function(req, res) {
            console.log(req.body);
            var data = {
                owner: req.session.wxUser._id,
                phone: req.param('phone'),
                name: req.param('name')
            };

            core.rooms.create(data, function(err, room) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }
                res.render('room/index.html');
            });
        });
};
