//
// Require Login
//

'use strict';

var mongoose = require('mongoose');

module.exports = function(req, res, next) {
    var room = req.params.room;

    if (!room) {
        return res.sendStatus(404);
    }

    console.log('room id: ' + room);

    var Room = mongoose.model('Room');

    Room.findById(room, function(err, room) {
        if (err) {
            return res.sendStatus(400);
        }
        if (!room) {
            return res.sendStatus(404);
        }

        var roomId = room._id.toString();

        req.params.room = room;
        req.params.roomId = roomId;
        req.body.room = roomId;
        req.query.room = roomId;

        next();
    });
};
