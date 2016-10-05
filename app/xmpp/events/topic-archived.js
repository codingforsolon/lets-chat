'use strict';

var Presence = require('node-xmpp-server').Presence,
    EventListener = require('./../event-listener');

module.exports = EventListener.extend({

    on: 'topics:archived',

    then: function(topic) {
        var connections = this.getConnectionsForTopic(topic._id);

        connections.forEach(function(connection) {
            // Kick connection from topic!

            var presence = new Presence({
                to: connection.jid(topic.slug),
                from: connection.jid(topic.slug),
                type: 'unavailable'
            });

            var x = presence
            .c('x', {
                xmlns: 'http://jabber.org/protocol/muc#user'
            });

            x.c('item', {
                jid: connection.jid(),
                affiliation: 'none',
                role: 'none'
            });

            x.c('destroy').c('reason').t('Topic closed');

            this.send(connection, presence);

        }, this);
    }

});
