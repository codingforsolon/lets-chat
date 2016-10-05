//
// Topic
//

'use strict';

var mongoose = require('mongoose'),
    uniqueValidator = require('mongoose-unique-validator'),
    bcrypt = require('bcryptjs');

var ObjectId = mongoose.Schema.Types.ObjectId;

var TopicSchema = new mongoose.Schema({
    roomId: {
        type: ObjectId,
        ref: 'Room'
    },
    type: {
        type: String,
        trim: true
    },
    title: {
        type: String,
        trim: true
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    password: {
        type: String,
        trim: true
    },
    price: {
        type: Number
    },
    showIntro: {
        type: Boolean
    },
    background: {
        type: String,
        trim: true
    },
    speaker: {
        type: String,
        trim: true
    },
    speakerInfo: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    state: {
        type: String,
        trim: true
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

TopicSchema.virtual('handle').get(function() {
    return this.slug || this.name.replace(/\W/i, '');
});

TopicSchema.virtual('hasPassword').get(function() {
    return !!this.password;
});

TopicSchema.pre('save', function(next) {
    var topic = this;
    if (!topic.password || !topic.isModified('password')) {
        return next();
    }

    bcrypt.hash(topic.password, 10, function(err, hash) {
        if (err) {
            return next(err);
        }
        topic.password = hash;
        next();
    });
});

TopicSchema.plugin(uniqueValidator, {
    message: 'Expected {PATH} to be unique'
});

TopicSchema.method('isAuthorized', function(userId) {
    if (!userId) {
        return false;
    }

    userId = userId.toString();

    // Check if userId doesn't match MongoID format
    if (!/^[a-f\d]{24}$/i.test(userId)) {
        return false;
    }

    if (!this.password && !this.private) {
        return true;
    }

    if (this.owner.equals(userId)) {
        return true;
    }

    return this.participants.some(function(participant) {
        if (participant._id) {
            return participant._id.equals(userId);
        }

        if (participant.equals) {
            return participant.equals(userId);
        }

        if (participant.id) {
            return participant.id === userId;
        }

        return participant === userId;
    });
});

TopicSchema.method('canJoin', function(options, cb) {
    var userId = options.userId,
        password = options.password,
        saveMembership = options.saveMembership;

    if (this.isAuthorized(userId)) {
        return cb(null, true);
    }

    if (!this.password) {
        return cb(null, false);
    }

    bcrypt.compare(password || '', this.password, function(err, isMatch) {
        if(err) {
            return cb(err);
        }

        if (!isMatch) {
            return cb(null, false);
        }

        if (!saveMembership) {
            return cb(null, true);
        }

        this.participants.push(userId);

        this.save(function(err) {
            if(err) {
                return cb(err);
            }

            cb(null, true);
        });

    }.bind(this));
});

TopicSchema.method('toJSON', function(user) {
    var userId = user ? (user._id || user.id || user) : null;
    var authorized = false;

    if (userId) {
        authorized = this.isAuthorized(userId);
    }

    var topic = this.toObject();

    var data = {
        id: topic._id,
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        lastActive: topic.lastActive,
        created: topic.created,
        owner: topic.owner,
        private: topic.private,
        hasPassword: this.hasPassword,
        participants: []
    };

    if (topic.private && authorized) {
        var participants = this.participants || [];
        data.participants = participants.map(function(user) {
            return user.username ? user.username : user;
        });
    }

    if (this.users) {
        data.users = this.users;
        data.userCount = this.users.length;
    }

    return data;
 });

TopicSchema.statics.findByIdOrSlug = function(identifier, cb) {
    var opts = {
        archived: { $ne: true }
    };

    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
        opts.$or = [{_id: identifier}, {slug: identifier}];
    } else {
        opts.slug = identifier;
    }

    this.findOne(opts, cb);
};

module.exports = mongoose.model('Topic', TopicSchema);
