'use strict';

var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    _ = require('lodash'),
    Topic = require('./topic');

function TopicCollection() {
    EventEmitter.call(this);
    this.topics = {};

    this.get = this.get.bind(this);
    this.getOrAdd = this.getOrAdd.bind(this);

    this.onJoin = this.onJoin.bind(this);
    this.onLeave = this.onLeave.bind(this);
}

util.inherits(TopicCollection, EventEmitter);

TopicCollection.prototype.get = function(topicId) {
    topicId = topicId.toString();
    return this.topics[topicId];
};

TopicCollection.prototype.slug = function(slug) {
    return _.find(this.topics, function(topic) {
        return topic.topicSlug === slug;
    });
};

TopicCollection.prototype.getOrAdd = function(topic) {
    var topicId = topic._id.toString();
    var pTopic = this.topics[topicId];
    if (!pTopic) {
        pTopic = this.topics[topicId] = new Topic({
            topic: topic
        });
        pTopic.on('user_join', this.onJoin);
        pTopic.on('user_leave', this.onLeave);
    }
    return pTopic;
};

TopicCollection.prototype.onJoin = function(data) {
    this.emit('user_join', data);
};

TopicCollection.prototype.onLeave = function(data) {
    this.emit('user_leave', data);
};

TopicCollection.prototype.usernameChanged = function(data) {
    Object.keys(this.topics).forEach(function(key) {
        this.topics[key].usernameChanged(data);
    }, this);
};

TopicCollection.prototype.removeConnection = function(connection) {
    Object.keys(this.topics).forEach(function(key) {
        this.topics[key].removeConnection(connection);
    }, this);
};

module.exports = TopicCollection;
