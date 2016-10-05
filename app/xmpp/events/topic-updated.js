'use strict';

var Message = require('node-xmpp-server').Message,
    EventListener = require('./../event-listener');

module.exports = EventListener.extend({

    on: 'topics:update',

    then: function(topic) {
        var connections = this.getConnectionsForTopic(topic._id);

        connections.forEach(function(connection) {

            var message = new Message({
                to: connection.jid(topic.slug),
                from: connection.jid(topic.slug),
                type: 'groupchat'
            });

            message.c('subject').t(topic.name + ' | ' + topic.description);

            this.send(connection, message);

        }, this);
    }

});
