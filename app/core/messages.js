'use strict';

var _ = require('lodash'),
    mongoose = require('mongoose'),
    helpers = require('./helpers');

function MessageManager(options) {
    this.core = options.core;
}

MessageManager.prototype.create = function(options, cb) {
    var Message = mongoose.model('Message'),
        Topic = mongoose.model('Topic'),
        User = mongoose.model('User');

    if (typeof cb !== 'function') {
        cb = function() {};
    }

    Topic.findById(options.topic, function(err, topic) {
        if (err) {
            console.error(err);
            return cb(err);
        }
        if (!topic) {
            return cb('Topic does not exist.');
        }
        if (topic.archived) {
            return cb('Topic is archived.');
        }
        if (!topic.isAuthorized(options.owner)) {
            return cb('Not authorized.');
        }

        Message.create(options, function(err, message) {
            if (err) {
                console.error(err);
                return cb(err);
            }
            // Touch Topic's lastActive
            topic.lastActive = message.posted;
            topic.save();
            // Temporary workaround for _id until populate can do aliasing
            User.findOne(message.owner, function(err, user) {
                if (err) {
                    console.error(err);
                    return cb(err);
                }

                cb(null, message, topic, user);
                this.core.emit('messages:new', message, topic, user, options.data);
            }.bind(this));
        }.bind(this));
    }.bind(this));
};

MessageManager.prototype.list = function(options, cb) {
    var Topic = mongoose.model('Topic');

    options = options || {};

    if (!options.topic) {
        return cb(null, []);
    }

    options = helpers.sanitizeQuery(options, {
        defaults: {
            reverse: true,
            take: 500
        },
        maxTake: 5000
    });

    var Message = mongoose.model('Message');

    var find = Message.find({
        topic: options.topic
    });

    if (options.since_id) {
        find.where('_id').gt(options.since_id);
    }

    if (options.from) {
        find.where('posted').gt(options.from);
    }

    if (options.to) {
        find.where('posted').lte(options.to);
    }

    if (options.query) {
        find = find.find({$text: {$search: options.query}});
    }

    if (options.expand) {
        var includes = options.expand.replace(/\s/, '').split(',');

        if (_.includes(includes, 'owner')) {
            find.populate('owner', 'id name avatar');
        }

        if (_.includes(includes, 'topic')) {
            find.populate('topic', 'id title');
        }
    }

    if (options.skip) {
        find.skip(options.skip);
    }

    if (options.reverse) {
        find.sort({ 'posted': -1 });
    } else {
        find.sort({ 'posted': 1 });
    }

    Topic.findById(options.topic, function(err, topic) {
        if (err) {
            console.error(err);
            return cb(err);
        }

        var opts = {
            userId: options.userId,
            password: options.password
        };

        topic.canJoin(opts, function(err, canJoin) {
            if (err) {
                console.error(err);
                return cb(err);
            }

            if (!canJoin) {
                return cb(null, []);
            }

            find.limit(options.take)
                .exec(function(err, messages) {
                    if (err) {
                        console.error(err);
                        return cb(err);
                    }
                    cb(null, messages);
                });
        });
    });
};

module.exports = MessageManager;
