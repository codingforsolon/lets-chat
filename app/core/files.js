'use strict';

var _ = require('lodash'),
    mongoose = require('mongoose'),
    helpers = require('./helpers'),
    plugins = require('./../plugins'),
    settings = require('./../config').files;

var enabled = settings.enable;

function FileManager(options) {
    this.core = options.core;

    if (!enabled) {
        return;
    }

    var Provider;

    if (settings.provider === 'local') {
        Provider = require('./files/local');
    } else {
        Provider = plugins.getPlugin(settings.provider, 'files');
    }

    this.provider = new Provider(settings[settings.provider]);
}

FileManager.prototype.create = function(options, cb) {
    if (!enabled) {
        return cb('Files are disabled.');
    }

    var File = mongoose.model('File'),
        Topic = mongoose.model('Topic'),
        User = mongoose.model('User');

    if (settings.restrictTypes &&
        settings.allowedTypes &&
        settings.allowedTypes.length &&
        !_.includes(settings.allowedTypes, options.file.mimetype)) {
            return cb('The MIME type ' + options.file.mimetype +
                      ' is not allowed');
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

        new File({
            owner: options.owner,
            name: options.file.originalname,
            type: options.file.mimetype,
            size: options.file.size,
            topic: options.topic
        }).save(function(err, savedFile) {
            if (err) {
                return cb(err);
            }

            this.provider.save({file: options.file, doc: savedFile}, function(err) {
                if (err) {
                    savedFile.remove();
                    return cb(err);
                }

                // Temporary workaround for _id until populate can do aliasing
                User.findOne(options.owner, function(err, user) {
                    if (err) {
                        console.error(err);
                        return cb(err);
                    }

                    cb(null, savedFile, topic, user);

                    this.core.emit('files:new', savedFile, topic, user);

                    if (options.post) {
                        this.core.messages.create({
                            topic: topic,
                            owner: user.id,
                            text: 'upload://' + savedFile.url
                        });
                    }
                }.bind(this));
            }.bind(this));
        }.bind(this));
    }.bind(this));
};

FileManager.prototype.list = function(options, cb) {
    var Topic = mongoose.model('Topic');

    if (!enabled) {
        return cb(null, []);
    }

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

    var File = mongoose.model('File');

    var find = File.find({
        topic: options.topic
    });

    if (options.from) {
        find.where('uploaded').gt(options.from);
    }

    if (options.to) {
        find.where('uploaded').lte(options.to);
    }

    if (options.expand) {
        var includes = options.expand.replace(/\s/, '').split(',');

        if (_.includes(includes, 'owner')) {
            find.populate('owner', 'id username displayName email avatar');
        }
    }

    if (options.skip) {
        find.skip(options.skip);
    }

    if (options.reverse) {
        find.sort({ 'uploaded': -1 });
    } else {
        find.sort({ 'uploaded': 1 });
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

            find
                .limit(options.take)
                .exec(function(err, files) {
                    if (err) {
                        console.error(err);
                        return cb(err);
                    }
                    cb(null, files);
                });
        });
    });
};

FileManager.prototype.getUrl = function(file) {
    if (!enabled) {
        return;
    }

    return this.provider.getUrl(file);
};

module.exports = FileManager;
