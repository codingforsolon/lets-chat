//
// LCB Client
//

(function(window, $, _) {

    var TopicStore = {
        add: function(id) {
            var topics = store.get('opentopics') || [];
            if (!_.contains(topics, id)) {
                topics.push(id);
                store.set('opentopics', topics);
            }
        },
        remove: function(id) {
            var topics = store.get('opentopics') || [];
            if (_.contains(topics, id)) {
                store.set('opentopics', _.without(topics, id));
            }
        },
        get: function() {
            var topics = store.get('opentopics') || [];
            topics = _.uniq(topics);
            store.set('opentopics', topics);
            return topics;
        }
    };

    //
    // Base
    //
    var Client = function(options) {
        this.options = options;
        this.status = new Backbone.Model();
        this.user = new UserModel();
        this.users = new UsersCollection();
        this.topics = new TopicsCollection();
        this.events = _.extend({}, Backbone.Events);
        return this;
    };
    //
    // Account
    //
    Client.prototype.getUser = function() {
        var that = this;
        this.socket.emit('account:whoami', function(user) {
            that.user.set(user);
        });
    };
    Client.prototype.updateProfile = function(profile) {
        var that = this;
        this.socket.emit('account:profile', profile, function(user) {
            that.user.set(user);
        });
    };

    //
    // Topics
    //
    Client.prototype.createTopic = function(data) {
        var that = this;
        var topic = {
            name: data.name,
            slug: data.slug,
            description: data.description,
            password: data.password,
            participants: data.participants,
            private: data.private
        };
        var callback = data.callback;
        this.socket.emit('topics:create', topic, function(topic) {
            if (topic && topic.errors) {
                swal("Unable to create topic",
                     "Topic slugs can only contain lower case letters, numbers or underscores!",
                     "error");
            } else if (topic && topic.id) {
                that.addTopic(topic);
                that.switchTopic(topic.id);
            }
            callback && callback(topic);
        });
    };
    Client.prototype.getTopics = function(cb) {
        var that = this;
        this.socket.emit('topics:list', { users: true }, function(topics) {
            that.topics.set(topics);
            // Get users for each topic!
            // We do it here for the topic browser
            _.each(topics, function(topic) {
                if (topic.users) {
                    that.setUsers(topic.id, topic.users);
                }
            });

            if (cb) {
                cb(topics);
            }
        });
    };
    Client.prototype.switchTopic = function(id) {
        // Make sure we have a last known topic ID
        this.topics.last.set('id', this.topics.current.get('id'));
        if (!id || id === 'list') {
            this.topics.current.set('id', 'list');
            this.router.navigate('!/', {
                replace: true
            });
            return;
        }
        var topic = this.topics.get(id);
        if (topic && topic.get('joined')) {
            this.topics.current.set('id', id);
            this.router.navigate('!/topic/' + topic.id, {
                replace: true
            });
            return;
        } else if(topic) {
            this.joinTopic(topic, true);
        } else {
            this.joinTopic({id: id}, true);
        }
    };
    Client.prototype.updateTopic = function(topic) {
        this.socket.emit('topics:update', topic);
    };
    Client.prototype.topicUpdate = function(resTopic) {
        var topic = this.topics.get(resTopic.id);
        if (!topic) {
            this.addTopic(resTopic);
            return;
        }
        topic.set(resTopic);
    };
    Client.prototype.addTopic = function(topic) {
        var r = this.topics.get(topic.id);
        if (r) {
            return r;
        }
        return this.topics.add(topic);
    };
    Client.prototype.archiveTopic = function(options) {
        this.socket.emit('topics:archive', options, function(data) {
            if (data !== 'No Content') {
                swal('Unable to Archive!',
                     'Unable to archive this topic!',
                     'error');
            }
        });
    };
    Client.prototype.topicArchive = function(topic) {
        this.leaveTopic(topic.id);
        this.topics.remove(topic.id);
    };
    Client.prototype.rejoinTopic = function(topic) {
        this.joinTopic(topic, undefined, true);
    };
    Client.prototype.lockJoin = function(id) {
        if (_.contains(this.joining, id)) {
            return false;
        }

        this.joining = this.joining || [];
        this.joining.push(id);
        return true;
    };
    Client.prototype.unlockJoin = function(id) {
        var that = this;
        _.defer(function() {
            that.joining = _.without(that.joining, id);
        });
    };
    Client.prototype.joinTopic = function(topic, switchTopic, rejoin) {
        if (!topic || !topic.id) {
            return;
        }

        var that = this;
        var id = topic.id;
        var password = topic.password;

        if (!rejoin) {
            // Must not have already joined
            var topic1 = that.topics.get(id);
            if (topic1 && topic1.get('joined')) {
                return;
            }
        }

        if (!this.lockJoin(id)) {
            return;
        }

        var passwordCB = function(password) {
            topic.password = password;
            that.joinTopic(topic, switchTopic, rejoin);
        };

        this.socket.emit('topics:join', {topicId: id, password: password}, function(resTopic) {
            // Topic was likely archived if this returns
            if (!resTopic) {
                return;
            }

            if (resTopic && resTopic.errors &&
                resTopic.errors === 'password required') {

                that.passwordModal.show({
                    topicName: resTopic.topicName,
                    callback: passwordCB
                });

                that.unlockJoin(id);
                return;
            }

            if (resTopic && resTopic.errors) {
                that.unlockJoin(id);
                return;
            }

            var topic = that.addTopic(resTopic);
            topic.set('joined', true);

            if (topic.get('hasPassword')) {
                that.getTopicUsers(topic.id, _.bind(function(users) {
                    this.setUsers(topic.id, users);
                }, that));
            }

            // Get topic history
            that.getMessages({
                topic: topic.id,
                since_id: topic.lastMessage.get('id'),
                take: 200,
                expand: 'owner, topic',
                reverse: true
            }, function(messages) {
                messages.reverse();
                that.addMessages(messages, !rejoin && !topic.lastMessage.get('id'));
                !rejoin && topic.lastMessage.set(messages[messages.length - 1]);
            });

            if (that.options.filesEnabled) {
                that.getFiles({
                    topic: topic.id,
                    take: 15
                }, function(files) {
                    files.reverse();
                    that.setFiles(topic.id, files);
                });
            }
            // Do we want to switch?
            if (switchTopic) {
                that.switchTopic(id);
            }
            //
            // Add topic id to localstorage so we can reopen it on refresh
            //
            TopicStore.add(id);

            that.unlockJoin(id);
        });
    };
    Client.prototype.leaveTopic = function(id) {
        var topic = this.topics.get(id);
        if (topic) {
            topic.set('joined', false);
            topic.lastMessage.clear();
            if (topic.get('hasPassword')) {
                topic.users.set([]);
            }
        }
        this.socket.emit('topics:leave', id);
        if (id === this.topics.current.get('id')) {
            var topic = this.topics.get(this.topics.last.get('id'));
            this.switchTopic(topic && topic.get('joined') ? topic.id : '');
        }
        // Remove topic id from localstorage
        TopicStore.remove(id);
    };
    Client.prototype.getTopicUsers = function(id, callback) {
        this.socket.emit('topics:users', {
            topic: id
        }, callback);
    };
    //
    // Messages
    //
    Client.prototype.addMessage = function(message) {
        var topic = this.topics.get(message.topic);
        if (!topic || !message) {
            // Unknown topic, nothing to do!
            return;
        }
        topic.set('lastActive', message.posted);
        if (!message.historical) {
            topic.lastMessage.set(message);
        }
        topic.trigger('messages:new', message);
    };
    Client.prototype.addMessages = function(messages, historical) {
        _.each(messages, function(message) {
            if (historical) {
                message.historical = true;
            }
            this.addMessage(message);
        }, this);
    };
    Client.prototype.sendMessage = function(message) {
        this.socket.emit('messages:create', message);
    };
    Client.prototype.getMessages = function(query, callback) {
        this.socket.emit('messages:list', query, callback);
    };
    //
    // Files
    //
    Client.prototype.getFiles = function(query, callback) {
        this.socket.emit('files:list', {
            topic: query.topic || '',
            take: query.take || 40,
            expand: query.expand || 'owner'
        }, callback);
    };
    Client.prototype.setFiles = function(topicId, files) {
        if (!topicId || !files || !files.length) {
            // Nothing to do here...
            return;
        }
        var topic = this.topics.get(topicId);
        if (!topic) {
            // No topic
            return;
        }
        topic.files.set(files);
    };
    Client.prototype.addFile = function(file) {
        var topic = this.topics.get(file.topic);
        if (!topic) {
            // No topic
            return;
        }
        topic.files.add(file);
    };
    //
    // Users
    //
    Client.prototype.setUsers = function(topicId, users) {
        if (!topicId || !users || !users.length) {
            // Data is not valid
            return;
        }
        var topic = this.topics.get(topicId);
        if (!topic) {
            // No topic
            return;
        }
        topic.users.set(users);
    };
    Client.prototype.addUser = function(user) {
        var topic = this.topics.get(user.topic);
        if (!topic) {
            // No topic
            return;
        }
        topic.users.add(user);
    };
    Client.prototype.removeUser = function(user) {
        var topic = this.topics.get(user.topic);
        if (!topic) {
            // No topic
            return;
        }
        topic.users.remove(user.id);
    };
    Client.prototype.updateUser = function(user) {
        // Update if current user
        if (user.id == this.user.id) {
            this.user.set(user);
        }
        // Update all topics
        this.topics.each(function(topic) {
            var target = topic.users.findWhere({
                id: user.id
            });
            target && target.set(user);
        }, this);
    };
    Client.prototype.getUsersSync = function() {
        if (this.users.length) {
            return this.users;
        }

        var that = this;

        function success(users) {
            that.users.set(users);
        }

        $.ajax({url:'./users', async: false, success: success});

        return this.users;
    };
    //
    // Extras
    //
    Client.prototype.getEmotes = function(callback) {
        this.extras = this.extras || {};
        if (!this.extras.emotes) {
            // Use AJAX, so we can take advantage of HTTP caching
            // Also, it's a promise - which ensures we only load emotes once
            this.extras.emotes = $.get('./extras/emotes');
        }
        if (callback) {
            this.extras.emotes.done(callback);
        }
    };
    Client.prototype.getReplacements = function(callback) {
        this.extras = this.extras || {};
        if (!this.extras.replacements) {
            // Use AJAX, so we can take advantage of HTTP caching
            // Also, it's a promise - which ensures we only load emotes once
            this.extras.replacements = $.get('./extras/replacements');
        }
        if (callback) {
            this.extras.replacements.done(callback);
        }
    };

    //
    // Router Setup
    //
    Client.prototype.route = function() {
        var that = this;
        var Router = Backbone.Router.extend({
            routes: {
                '!/topic/': 'list',
                '!/topic/:id': 'join',
                '*path': 'list'
            },
            join: function(id) {
                that.switchTopic(id);
            },
            list: function() {
                that.switchTopic('list');
            }
        });
        this.router = new Router();
        Backbone.history.start();
    };
    //
    // Listen
    //
    Client.prototype.listen = function() {
        var that = this;

        function joinTopics(topics) {
            //
            // Join topics from localstorage
            // We need to check each topic is available before trying to join
            //
            var topicIds = _.map(topics, function(topic) {
                return topic.id;
            });

            var openTopics = TopicStore.get();
            // Let's open some topics!
            _.defer(function() {
                //slow down because router can start a join with no password
                _.each(openTopics, function(id) {
                    if (_.contains(topicIds, id)) {
                        that.joinTopic({ id: id });
                    }
                });
            }.bind(this));
        }

        var path = '/' + _.compact(
            window.location.pathname.split('/').concat(['socket.io'])
        ).join('/');
        console.log('====>path: ' + path);

        //
        // Socket
        //
        this.socket = io.connect({
            path: path,
            reconnection: true,
            reconnectionDelay: 500,
            reconnectionDelayMax: 1000,
            timeout: 3000
        });
        this.socket.on('connect', function() {
            that.getUser();
            that.getTopics(joinTopics);
            that.status.set('connected', true);
        });
        this.socket.on('reconnect', function() {
            _.each(that.topics.where({ joined: true }), function(topic) {
                that.rejoinTopic(topic);
            });
        });
        this.socket.on('messages:new', function(message) {
            that.addMessage(message);
        });
        this.socket.on('topics:new', function(data) {
            console.log('topic create!');
            that.addTopic(data);
        });
        this.socket.on('topics:update', function(topic) {
            that.topicUpdate(topic);
        });
        this.socket.on('topics:archive', function(topic) {
            that.topicArchive(topic);
        });
        this.socket.on('users:join', function(user) {
            that.addUser(user);
        });
        this.socket.on('users:leave', function(user) {
            that.removeUser(user);
        });
        this.socket.on('users:update', function(user) {
            that.updateUser(user);
        });
        this.socket.on('files:new', function(file) {
            that.addFile(file);
        });
        this.socket.on('disconnect', function() {
            that.status.set('connected', false);
        });
        //
        // GUI
        //
        this.events.on('messages:send', this.sendMessage, this);
        this.events.on('topics:update', this.updateTopic, this);
        this.events.on('topics:leave', this.leaveTopic, this);
        this.events.on('topics:create', this.createTopic, this);
        this.events.on('topics:switch', this.switchTopic, this);
        this.events.on('topics:archive', this.archiveTopic, this);
        this.events.on('profile:update', this.updateProfile, this);
        this.events.on('topics:join', this.joinTopic, this);
    };
    //
    // Start
    //
    Client.prototype.start = function() {
        this.getEmotes();
        this.getReplacements();
        this.listen();
        this.route();
        this.view = new window.LCB.ClientView({
            client: this
        });
        this.passwordModal = new window.LCB.TopicPasswordModalView({
            el: $('#lcb-password')
        });
        return this;
    };
    //
    // Add to window
    //
    window.LCB = window.LCB || {};
    window.LCB.Client = Client;
})(window, $, _);
