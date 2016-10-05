'use strict';

var Connection = require('./presence/connection'),
    Topic = require('./presence/topic'),
    ConnectionCollection = require('./presence/connection-collection'),
    TopicCollection = require('./presence/topic-collection'),
    UserCollection = require('./presence/user-collection');

function PresenceManager(options) {
    this.core = options.core;
    this.system = new Topic({ system: true });
    this.connections = new ConnectionCollection();
    this.topics = new TopicCollection();
    this.users = new UserCollection({ core: this.core });
    this.topics.on('user_join', this.onJoin.bind(this));
    this.topics.on('user_leave', this.onLeave.bind(this));

    this.connect = this.connect.bind(this);
    this.getUserCountForTopic = this.getUserCountForTopic.bind(this);
    this.getUsersForTopic = this.getUsersForTopic.bind(this);
}

PresenceManager.prototype.getUserCountForTopic = function(topicId) {
    var topic = this.topics.get(topicId);
    return topic ? topic.userCount : 0;
};

PresenceManager.prototype.getUsersForTopic = function(topicId) {
    var topic = this.topics.get(topicId);
    return topic ? topic.getUsers() : [];
};

PresenceManager.prototype.connect = function(connection) {
    this.system.addConnection(connection);
    this.core.emit('connect', connection);

    connection.user = this.users.getOrAdd(connection.user);

    connection.on('disconnect', function() {
        this.disconnect(connection);
    }.bind(this));
};

PresenceManager.prototype.disconnect = function(connection) {
    this.system.removeConnection(connection);
    this.core.emit('disconnect', connection);
    this.topics.removeConnection(connection);
};

PresenceManager.prototype.join = function(connection, topic) {
    var pTopic = this.topics.getOrAdd(topic);
    pTopic.addConnection(connection);
};

PresenceManager.prototype.leave = function(connection, topicId) {
    var topic = this.topics.get(topicId);
    if (topic) {
        topic.removeConnection(connection);
    }
};

PresenceManager.prototype.onJoin = function(data) {
    this.core.emit('presence:user_join', data);
};

PresenceManager.prototype.onLeave = function(data) {
    this.core.emit('presence:user_leave', data);
};

PresenceManager.Connection = Connection;
module.exports = PresenceManager;
