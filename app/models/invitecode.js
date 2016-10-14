//
// Room
//

'use strict';

var mongoose = require('mongoose'),
    uniqueValidator = require('mongoose-unique-validator');

var ObjectId = mongoose.Schema.Types.ObjectId;

var InviteCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        trim: true
    },
    user: {
        type: ObjectId,
        ref: 'User'
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    usedAt: {
        type: Date
    },
    expiredAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

InviteCodeSchema.plugin(uniqueValidator, {
    message: 'Expected {PATH} to be unique'
});

module.exports = mongoose.model('InviteCode', InviteCodeSchema);
