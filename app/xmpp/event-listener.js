'use strict';

var settings = require('./../config'),
    _ = require('lodash'),
    util = require('util');


function EventListener(core) {
    this.core = core;

    this.getConnectionsForTopic = this.getConnectionsForTopic.bind(this);
    this.send = this.send.bind(this);
}

EventListener.prototype.getConnectionsForTopic = function(topicId) {
    var topic = this.core.presence.topics.get(topicId);

    if (!topic) {
        return [];
    }

    return topic.connections.query({ type: 'xmpp' });
};

EventListener.prototype.send = function() {
    var connection = arguments[0],
        msgs = Array.prototype.slice.call(arguments, 1);

    msgs = _.flatten(msgs);

    msgs.forEach(function(msg) {
        if (settings.xmpp.debug.handled) {
            console.log(msg.root().toString().yellow);
        }
        connection.client.send(msg);
    });
};

EventListener.extend = function(options) {
    var listener = function() {
        EventListener.apply(this, arguments);
        this.then = this.then.bind(this);
    };

    util.inherits(listener, EventListener);

    listener.prototype.on = options.on;
    listener.prototype.then = options.then;

    return listener;
};

module.exports = EventListener;
