'use strict';

var mongoose = require('mongoose'),
    _ = require('lodash'),
    helpers = require('./helpers');

function RoomManager(options) {
    this.core = options.core;
}

RoomManager.prototype.create = function(options, cb) {
    var Room = mongoose.model('Room');
    Room.create(options, function(err, room) {
        console.log('in create');
        if (err) {
            return cb(err);
        }

        if (cb) {
            cb(null, room);
        }
    }.bind(this));
};

RoomManager.prototype.findByOwner = function(owner, cb) {
    var Room = mongoose.model('Room');
    Room.findOne({owner: owner}).exec(function(err, room) {
        if (err) {
            return cb(err);
        }
        if (cb) {
            cb(null, room);
        }
    });
};

RoomManager.prototype.update = function(roomId, options, cb) {
    var Room = mongoose.model('Room');

    Room.findById(roomId, function(err, room) {
        if (err) {
            // Oh noes, a bad thing happened!
            console.error(err);
            return cb(err);
        }

        if (!room) {
            return cb('Room does not exist.');
        }

        if(room.private && !room.owner.equals(options.user.id)) {
            return cb('Only owner can change private room.');
        }
    }.bind(this));
};

RoomManager.prototype.findOne = function(options, cb) {
    var Room = mongoose.model('Room');
    Room.findOne(options.criteria)
        .populate('participants').exec(function(err, room) {

        if (err) {
            return cb(err);
        }

        this.sanitizeRoom(options, room);
        cb(err, room);

    }.bind(this));
};

RoomManager.prototype.get = function(options, cb) {
    var identifier;

    if (typeof options === 'string') {
        identifier = options;
        options = {};
        options.identifier = identifier;
    } else {
        identifier = options.identifier;
    }

    options.criteria = {
        _id: identifier,
        archived: { $ne: true }
    };

    this.findOne(options, cb);
};

module.exports = RoomManager;
