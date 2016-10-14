'use strict';

var mongoose = require('mongoose'),
    _ = require('lodash'),
    helpers = require('./helpers');

function InviteCodeManager(options) {
    this.core = options.core;
}

InviteCodeManager.prototype.create = function(options, cb) {
    var InviteCode = mongoose.model('InviteCode');
    InviteCode.create({
        code: options.code,
        type: options.type,
        expiredAt: _.now()
    }, function(err, inviteCode) {

    });
};

InviteCodeManager.prototype.findByOwner = function(owner, cb) {
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

InviteCodeManager.prototype.update = function(roomId, options, cb) {
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

InviteCodeManager.prototype.findOne = function(options, cb) {
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

InviteCodeManager.prototype.get = function(options, cb) {
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

module.exports = InviteCodeManager;
