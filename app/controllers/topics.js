//
// Topics Controller
//

'use strict';

var settings = require('./../config').topics;

module.exports = function() {
    var app = this.app,
        core = this.core,
        middlewares = this.middlewares,
        models = this.models,
        User = models.user;

    core.on('presence:user_join', function(data) {
        User.findById(data.userId, function (err, user) {
            if (!err && user) {
                user = user.toJSON();
                user.topic = data.topicId;
                if (data.topicHasPassword) {
                    app.io.to(data.topicId).emit('users:join', user);
                } else {
                    app.io.emit('users:join', user);
                }
            }
        });
    });

    core.on('presence:user_leave', function(data) {
        User.findById(data.userId, function (err, user) {
            if (!err && user) {
                user = user.toJSON();
                user.topic = data.topicId;
                if (data.topicHasPassword) {
                    app.io.to(data.topicId).emit('users:leave', user);
                } else {
                    app.io.emit('users:leave', user);
                }
            }
        });
    });

    var getEmitters = function(topic) {
        if (topic.private && !topic.hasPassword) {
            console.log('~~~~~~~~~');
            console.log(topic);
            var connections = core.presence.connections.query({
                type: 'socket.io'
            }).filter(function(connection) {
                return topic.isAuthorized(connection.user);
            });

            return connections.map(function(connection) {
                return {
                    emitter: connection.socket,
                    user: connection.user
                };
            });
        }

        return [{
            emitter: app.io
        }];
    };

    core.on('topics:new', function(topic) {
        console.log('server core emit');
        var emitters = getEmitters(topic);
        console.log(emitters);
        emitters.forEach(function(e) {
            e.emitter.emit('topics:new', topic.toJSON(e.user));
        });
    });

    core.on('topics:update', function(topic) {
        var emitters = getEmitters(topic);
        emitters.forEach(function(e) {
            e.emitter.emit('topics:update', topic.toJSON(e.user));
        });
    });

    core.on('topics:archive', function(topic) {
        var emitters = getEmitters(topic);
        emitters.forEach(function(e) {
            e.emitter.emit('topics:archive', topic.toJSON(e.user));
        });
    });


    //
    // Routes
    //
    app.route('/topics')
        .all(middlewares.requireLogin)
        .get(function(req) {
            req.io.route('topics:list');
        })
        .post(function(req) {
            req.io.route('topics:create');
        });

    app.route('/topics/:topic')
        .all(middlewares.requireLogin, middlewares.topicRoute)
        .get(function(req) {
            req.io.route('topics:get');
        })
        .put(function(req) {
            req.io.route('topics:update');
        })
        .delete(function(req) {
            req.io.route('topics:archive');
        });

    app.route('/topics/:topic/users')
        .all(middlewares.requireLogin, middlewares.topicRoute)
        .get(function(req) {
            req.io.route('topics:users');
        });


    //
    // Sockets
    //
    app.io.route('topics', {
        list: function(req, res) {
            var options = {
                    userId: req.user._id,
                    users: req.param('users'),

                    skip: req.param('skip'),
                    take: req.param('take')
                };

            core.topics.list(options, function(err, topics) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                var results = topics.map(function(topic) {
                    return topic.toJSON(req.user);
                });

                res.json(results);
            });
        },
        get: function(req, res) {
            var options = {
                userId: req.user._id,
                identifier: req.param('topic') || req.param('id')
            };

            core.topics.get(options, function(err, topic) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                if (!topic) {
                    return res.sendStatus(404);
                }

                res.json(topic.toJSON(req.user));
            });
        },
        create: function(req, res) {
            var options = {
                owner: req.user._id,
                name: req.param('name'),
                slug: req.param('slug'),
                description: req.param('description'),
                private: req.param('private'),
                password: req.param('password')
            };

            if (!settings.private) {
                options.private = false;
                delete options.password;
            }

            core.topics.create(options, function(err, topic) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                res.status(201).json(topic.toJSON(req.user));
            });
        },
        update: function(req, res) {
            var topicId = req.param('topic') || req.param('id');

            var options = {
                    name: req.param('name'),
                    slug: req.param('slug'),
                    description: req.param('description'),
                    password: req.param('password'),
                    participants: req.param('participants'),
                    user: req.user
                };

            if (!settings.private) {
                delete options.password;
                delete options.participants;
            }

            core.topics.update(topicId, options, function(err, topic) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                if (!topic) {
                    return res.sendStatus(404);
                }

                res.json(topic.toJSON(req.user));
            });
        },
        archive: function(req, res) {
            var topicId = req.param('topic') || req.param('id');

            core.topics.archive(topicId, function(err, topic) {
                if (err) {
                    console.log(err);
                    return res.sendStatus(400);
                }

                if (!topic) {
                    return res.sendStatus(404);
                }

                res.sendStatus(204);
            });
        },
        join: function(req, res) {
            var options = {
                    userId: req.user._id,
                    saveMembership: true
                };

            if (typeof req.data === 'string') {
                options.id = req.data;
            } else {
                options.id = req.param('topicId');
                options.password = req.param('password');
            }

            core.topics.canJoin(options, function(err, topic, canJoin) {
                if (err) {
                    console.error(err);
                    return res.sendStatus(400);
                }

                if (!topic) {
                    return res.sendStatus(404);
                }

                if(!canJoin && topic.password) {
                    return res.status(403).json({
                        status: 'error',
                        topicName: topic.name,
                        message: 'password required',
                        errors: 'password required'
                    });
                }

                if(!canJoin) {
                    return res.sendStatus(404);
                }

                var user = req.user.toJSON();
                user.topic = topic._id;

                core.presence.join(req.socket.conn, topic);
                req.socket.join(topic._id);
                res.json(topic.toJSON(req.user));
            });
        },
        leave: function(req, res) {
            var topicId = req.data;
            var user = req.user.toJSON();
            user.topic = topicId;

            core.presence.leave(req.socket.conn, topicId);
            req.socket.leave(topicId);
            res.json();
        },
        users: function(req, res) {
            var topicId = req.param('topic');

            core.topics.get(topicId, function(err, topic) {
                if (err) {
                    console.error(err);
                    return res.sendStatus(400);
                }

                if (!topic) {
                    return res.sendStatus(404);
                }

                var users = core.presence.topics
                        .getOrAdd(topic)
                        .getUsers()
                        .map(function(user) {
                            // TODO: Do we need to do this?
                            user.topic = topic.id;
                            return user;
                        });

                res.json(users);
            });
        }
    });
};
