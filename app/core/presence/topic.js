'use strict';

var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    ConnectionCollection = require('./connection-collection');

function Topic(options) {
    EventEmitter.call(this);

    if (options.system) {
        // This is the system topic
        // Used for tracking what users are online
        this.system = true;
        this.topicId = undefined;
        this.topicSlug = undefined;
        this.hasPassword = false;
    } else {
        this.system = false;
        this.topicId = options.topic._id.toString();
        this.topicSlug = options.topic.slug;
        this.hasPassword = options.topic.hasPassword;
    }

    this.connections = new ConnectionCollection();
    this.userCount = 0;

    this.getUsers = this.getUsers.bind(this);
    this.getUserIds = this.getUserIds.bind(this);
    this.getUsernames = this.getUsernames.bind(this);
    this.containsUser = this.containsUser.bind(this);

    this.emitUserJoin = this.emitUserJoin.bind(this);
    this.emitUserLeave = this.emitUserLeave.bind(this);
    this.addConnection = this.addConnection.bind(this);
    this.removeConnection = this.removeConnection.bind(this);
}

util.inherits(Topic, EventEmitter);

Topic.prototype.getUsers = function() {
    return this.connections.getUsers();
};

Topic.prototype.getUserIds = function() {
    return this.connections.getUserIds();
};

Topic.prototype.getUsernames = function() {
    return this.connections.getUsernames();
};

Topic.prototype.containsUser = function(userId) {
    return this.getUserIds().indexOf(userId) !== -1;
};

Topic.prototype.emitUserJoin = function(data) {
    this.userCount++;

    var d = {
        userId: data.userId,
        username: data.username
    };

    if (this.system) {
        d.system = true;
    } else {
        d.topicId = this.topicId;
        d.topicSlug = this.topicSlug;
        d.topicHasPassword = this.hasPassword;
    }

    this.emit('user_join', d);
};

Topic.prototype.emitUserLeave = function(data) {
    this.userCount--;

    var d = {
        user: data.user,
        userId: data.userId,
        username: data.username
    };

    if (this.system) {
        d.system = true;
    } else {
        d.topicId = this.topicId;
        d.topicSlug = this.topicSlug;
        d.topicHasPassword = this.hasPassword;
    }

    this.emit('user_leave', d);
};

Topic.prototype.usernameChanged = function(data) {
    if (this.containsUser(data.userId)) {
        // User leaving topic
        this.emitUserLeave({
            userId: data.userId,
            username: data.oldUsername
        });
        // User rejoining topic with new username
        this.emitUserJoin({
            userId: data.userId,
            username: data.username
        });
    }
};

Topic.prototype.addConnection = function(connection) {
    if (!connection) {
        console.error('Attempt to add an invalid connection was detected');
        return;
    }

    if (connection.user && connection.user.id &&
        !this.containsUser(connection.user.id)) {
        // User joining topic
        this.emitUserJoin({
            user: connection.user,
            userId: connection.user.id,
            username: connection.user.username
        });
    }
    this.connections.add(connection);
};

Topic.prototype.removeConnection = function(connection) {
    if (!connection) {
        console.error('Attempt to remove an invalid connection was detected');
        return;
    }

    if (this.connections.remove(connection)) {
        if (connection.user && connection.user.id &&
            !this.containsUser(connection.user.id)) {
            // Leaving topic altogether
            this.emitUserLeave({
                user: connection.user,
                userId: connection.user.id,
                username: connection.user.username
            });
        }
    }
};

module.exports = Topic;
