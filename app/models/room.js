//
// Room
//

'use strict';

var mongoose = require('mongoose'),
    uniqueValidator = require('mongoose-unique-validator');

var ObjectId = mongoose.Schema.Types.ObjectId;

var RoomSchema = new mongoose.Schema({
    owner: {
        type: ObjectId,
        ref: 'User',
        required: true
    },
    speaker: {
        type: ObjectId,
        ref: 'User'
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    icon: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    background: {
        type: String,
        trim: true
    },
    qrcode: {
        type: String,
        trim: true
    },
    admins: [{
        type: ObjectId,
        ref: 'User'
    }],
    link: {
        type: String,
        trim: true
    },
    likeId: {
        type: ObjectId,
        ref: 'Like'
    },
    credit: {
        type: Number,
        default: 0
    },
    totalDeposit: {
        type: Number,
        default: 0
    },
    canLike: {
        type: Boolean,
        default: true
    },
    topics: [{
        type: ObjectId,
        ref: 'Topic'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

RoomSchema.plugin(uniqueValidator, {
    message: 'Expected {PATH} to be unique'
});

RoomSchema.statics.findById = function(id, cb) {
    this.findOne({_id: id}, cb);
};

// RoomSchema.method('toJSON', function(user) {
//     var userId = user ? (user._id || user.id || user) : null;
//     var authorized = false;
//
//     if (userId) {
//         authorized = this.isAuthorized(userId);
//     }
//
//     var room = this.toObject();
//
//     var data = {
//         id: room._id,
//         slug: room.slug,
//         name: room.name,
//         description: room.description,
//         lastActive: room.lastActive,
//         created: room.created,
//         owner: room.owner,
//         private: room.private,
//         hasPassword: this.hasPassword,
//         participants: []
//     };
//
//     if (room.private && authorized) {
//         var participants = this.participants || [];
//         data.participants = participants.map(function(user) {
//             return user.username ? user.username : user;
//         });
//     }
//
//     if (this.users) {
//         data.users = this.users;
//         data.userCount = this.users.length;
//     }
//
//     return data;
//  });

module.exports = mongoose.model('Room', RoomSchema);
