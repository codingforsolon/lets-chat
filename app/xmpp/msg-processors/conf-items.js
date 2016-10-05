'use strict';

var MessageProcessor = require('./../msg-processor');

module.exports = MessageProcessor.extend({

    if: function() {
        return this.toConfRoot &&
               this.ns['http://jabber.org/protocol/disco#items'];
    },

    then: function(cb) {
        this.core.topics.list(null, function(err, topics) {
            if (err) {
                return cb(err);
            }

            var stanza = this.Iq();

            var query = stanza.c('query', {
                xmlns: 'http://jabber.org/protocol/disco#items'
            });

            topics.forEach(function(topic) {
                query.c('item', {
                    jid: this.connection.getTopicJid(topic.slug),
                    name: topic.name
                });
            }, this);

            cb(null, stanza);

        }.bind(this));
    }

});
