//
// Require Login
//

'use strict';

var mongoose = require('mongoose');

module.exports = function(req, res, next) {
    var room = req.params.room;

    if (!room) {
        return res.redirect('/rooms');
    }

    console.log('room id: ' + room);

    var Room = mongoose.model('Room');

    Room.findOne({_id: room, owner: req.user}, function(err, room) {
        if (err) {
            return res.status(400).json(err);
        }
        if (!room) {
            Room.findOne({_id: room, admins: {"$in": [req.user]}}, function(err, room) {
                if (err) {
                    return res.status(400).json(err);
                }
                if (!room) {
                    return res.sendStatus(404);
                }
            });
        }

        var roomId = room._id.toString();

        req.params.room = room;
        req.params.roomId = roomId;
        req.body.room = roomId;
        req.query.room = roomId;

        next();
    });
};
