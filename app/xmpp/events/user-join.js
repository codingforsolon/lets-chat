'use strict';

var Presence = require('node-xmpp-server').Presence,
    EventListener = require('./../event-listener');

module.exports = EventListener.extend({

    on: 'presence:user_join',

    then: function(data) {
        var connections = this.getConnectionsForTopic(data.topicId);

        connections.forEach(function(connection) {
            var presence = new Presence({
                to: connection.jid(data.topicSlug),
                from: connection.getTopicJid(data.topicSlug, data.username)
            });

            presence
            .c('x', {
                xmlns: 'http://jabber.org/protocol/muc#user'
            })
            .c('item', {
                jid: connection.getUserJid(data.username),
                affiliation: 'none',
                role: 'participant'
            });

            if (data.user) {
                connection.populateVcard(presence, data.user, this.core);
            }

            this.send(connection, presence);
        }, this);
    }

});
