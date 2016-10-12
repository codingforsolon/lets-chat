//
// LCB Client
//

(function(window, $, _) {

    //
    // Base
    //
    var Client = function(options) {
        this.options = options;
        this.status = new Backbone.Model();
        this.user = new UserModel();
        this.users = new UsersCollection();
        this.topic = new TopicModel();
        this.events = _.extend({}, Backbone.Events);
        return this;
    };

    Client.prototype.getUser = function() {
        var that = this;
        this.socket.emit('account:whoami', function(user) {
            that.user.set(user);
        });
    };

    Client.prototype.updateTopic = function(topic) {
        this.socket.emit('topics:update', topic);
    };
    Client.prototype.topicUpdate = function(resTopic) {
        this.topic.set(resTopic);
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

            // if (resTopic && resTopic.errors &&
            //     resTopic.errors === 'password required') {
            //
            //     that.passwordModal.show({
            //         topicName: resTopic.topicName,
            //         callback: passwordCB
            //     });
            //
            //     that.unlockJoin(id);
            //     return;
            // }

            if (resTopic && resTopic.errors) {
                that.unlockJoin(id);
                return;
            }
            // console.log('res topic is :');
            // console.log(resTopic);
            console.log('that topic is :');
            console.log(that.topic);

            that.topic.set('joined', true);
            // if (that.topic.get('hasPassword')) {
            //     that.getTopicUsers(topic.id, _.bind(function(users) {
            //         this.setUsers(topic.id, users);
            //     }, that));
            // }

            // Get topic history
            that.getMessages({
                topic: that.topic.id,
                since_id: that.topic.lastMessage.get('id'),
                take: 200,
                expand: 'owner, topic',
                reverse: true
            }, function(messages) {
                messages.reverse();
                that.addMessages(messages, !rejoin && !that.topic.lastMessage.get('id'));
                !rejoin && that.topic.lastMessage.set(messages[messages.length - 1]);
            });

            if (that.options.filesEnabled) {
                that.getFiles({
                    topic: that.topic.id,
                    take: 15
                }, function(files) {
                    files.reverse();
                    that.setFiles(that.topic.id, files);
                });
            }
            // Do we want to switch?
            // if (switchTopic) {
            //     that.switchTopic(id);
            // }

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
    };
    Client.prototype.getTopic = function() {
        var that = this;
        var topicId = $("#topicId").val();
        console.log('topic id is: ' + topicId);
        this.socket.emit('topics:get', { topicId: topicId }, function(data) {
            console.log('topics get------>');
            console.log(data);
            that.topic.set(data.topic);
            console.log(that.topic.toJSON());
            that.joinTopic({id: that.topic.id});
        });
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
        this.topic.set('lastActive', message.posted);
        if (!message.historical) {
            this.topic.lastMessage.set(message);
        }
        this.topic.trigger('messages:new', message);
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
        this.topic.files.set(files);
    };
    Client.prototype.addFile = function(file) {
        this.topic.files.add(file);
    };
    //
    // Users
    //
    Client.prototype.setUsers = function(topicId, users) {
        if (!topicId || !users || !users.length) {
            // Data is not valid
            return;
        }
        this.topic.users.set(users);
    };
    Client.prototype.addUser = function(user) {
        this.topic.users.add(user);
    };
    Client.prototype.removeUser = function(user) {
        this.topic.users.remove(user.id);
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
            this.extras.emotes = $.get('/extras/emotes');
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
            this.extras.replacements = $.get('/extras/replacements');
        }
        if (callback) {
            this.extras.replacements.done(callback);
        }
    };

    //
    // Router Setup
    //
    Client.prototype.route = function() {
        console.log('in route');
        var that = this;
        var Router = Backbone.Router.extend({
            routes: {
                '/topics/:topic/topics/:topic/chat': 'join'
            },
            join: function(topic, topic) {
                console.log('join----------->');
                console.log(topic);
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

        // var path = '/' + _.compact(
        //     window.location.pathname.split('/').concat(['socket.io'])
        // ).join('/');
        // console.log('====>path: ' + path);
        path = '/socket.io';
        // path = 'http://localhost:5000/socket.io';

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
        console.log('gonna connect path: ' + path);
        this.socket.on('connect', function() {
            console.log('connected--------->');
            that.getUser();
            that.getTopic();
            that.status.set('connected', true);
        });
        this.socket.on('connect_error', function() {
            console.log('connect_error');
        });
        this.socket.on('connect_timeout', function() {
            console.log('connect_timeout');
        });
        this.socket.on('reconnect attempt', function() {
            console.log('reconnect attempt');
        });
        this.socket.on('reconnect', function() {
            // _.each(that.topics.where({ joined: true }), function(topic) {
            //     that.rejoinTopic(topic);
            // });
        });
        this.socket.on('messages:new', function(message) {
            that.addMessage(message);
        });
        this.socket.on('topics:update', function(topic) {
            that.topicUpdate(topic);
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
