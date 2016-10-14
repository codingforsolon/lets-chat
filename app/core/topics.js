'use strict';

var mongoose = require('mongoose'),
    _ = require('lodash'),
    helpers = require('./helpers');

var getParticipants = function(topic, options, cb) {
    if (!topic.private || !options.participants) {
        return cb(null, []);
    }

    var participants = [];

    if (Array.isArray(options.participants)) {
        participants = options.participants;
    }

    if (typeof options.participants === 'string') {
        participants = options.participants.replace(/@/g, '')
            .split(',').map(function(username) {
                return username.trim();
            });
    }

    participants = _.chain(participants)
        .map(function(username) {
            return username && username.replace(/@,\s/g, '').trim();
        })
        .filter(function(username) { return !!username; })
        .uniq()
        .value();

    var User = mongoose.model('User');
    User.find({username: { $in: participants } }, cb);
};

function TopicManager(options) {
    this.core = options.core;
}

TopicManager.prototype.canJoin = function(options, cb) {
    var method = options.id ? 'get' : 'slug',
        topicId = options.id ? options.id : options.slug;

    this[method](topicId, function(err, topic) {
        if (err) {
            return cb(err);
        }

        if (!topic) {
            return cb();
        }

        topic.canJoin(options, function(err, canJoin) {
            cb(err, topic, canJoin);
        });
    });
};

TopicManager.prototype.create = function(options, cb) {
    var Topic = mongoose.model('Topic');
    Topic.create(options, function(err, topic) {
        if (err) {
            return cb(err);
        }

        if (cb) {
            cb(null, topic);
        }
    }.bind(this));
};

TopicManager.prototype.update = function(topicId, options, cb) {
    var Topic = mongoose.model('Topic');

    Topic.findById(topicId, function(err, topic) {
        if (err) {
            // Oh noes, a bad thing happened!
            console.error(err);
            return cb(err);
        }

        if (!topic) {
            return cb('Topic does not exist.');
        }

        if(topic.private && !topic.owner.equals(options.user.id)) {
            return cb('Only owner can change private topic.');
        }

        getParticipants(topic, options, function(err, participants) {
            if (err) {
                // Oh noes, a bad thing happened!
                console.error(err);
                return cb(err);
            }

            topic.name = options.name;
            // DO NOT UPDATE SLUG
            // topic.slug = options.slug;
            topic.description = options.description;

            if (topic.private) {
                topic.password = options.password;
                topic.participants = participants;
            }

            topic.save(function(err, topic) {
                if (err) {
                    console.error(err);
                    return cb(err);
                }
                topic = topic;
                cb(null, topic);
                this.core.emit('topics:update', topic);
            }.bind(this));
        }.bind(this));
    }.bind(this));
};

// TopicManager.prototype.archive = function(topicId, cb) {
//     var Topic = mongoose.model('Topic');
//
//     Topic.findById(topicId, function(err, topic) {
//         if (err) {
//             // Oh noes, a bad thing happened!
//             console.error(err);
//             return cb(err);
//         }
//
//         if (!topic) {
//             return cb('Topic does not exist.');
//         }
//
//         topic.archived = true;
//         topic.save(function(err, topic) {
//             if (err) {
//                 console.error(err);
//                 return cb(err);
//             }
//             cb(null, topic);
//             this.core.emit('topics:archive', topic);
//
//         }.bind(this));
//     }.bind(this));
// };

TopicManager.prototype.sanitizeTopic = function(options, topic) {
    var authorized = options.userId && topic.isAuthorized(options.userId);

    if (options.users) {
        if (authorized) {
            topic.users = this.core.presence
                        .getUsersForTopic(topic.id.toString());
        } else {
            topic.users = [];
        }
    }
};

TopicManager.prototype.findOne = function(options, cb) {
    var Topic = mongoose.model('Topic');
    Topic.findOne(options.criteria)
        .populate('participants').exec(function(err, topic) {

        if (err) {
            return cb(err);
        }

        // this.sanitizeTopic(options, topic);
        cb(err, topic);

    }.bind(this));
};

TopicManager.prototype.get = function(options, cb) {
    var identifier;

    if (typeof options === 'string') {
        identifier = options;
        options = {};
        options.identifier = identifier;
    } else {
        identifier = options.identifier;
    }

    options.criteria = {
        _id: identifier
    };

    this.findOne(options, cb);
};

TopicManager.prototype.slug = function(options, cb) {
    var identifier;

    if (typeof options === 'string') {
        identifier = options;
        options = {};
        options.identifier = identifier;
    } else {
        identifier = options.identifier;
    }

    options.criteria = {
        slug: identifier,
        archived: { $ne: true }
    };

    this.findOne(options, cb);
};

TopicManager.prototype.findByRoom = function (options, cb) {
    var Topic = mongoose.model('Topic');
    Topic.find({room: options.room}, function(err, topics) {
        cb(err, topics);
    });
};

module.exports = TopicManager;
