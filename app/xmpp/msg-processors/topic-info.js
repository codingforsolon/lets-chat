'use strict';

var MessageProcessor = require('./../msg-processor');

module.exports = MessageProcessor.extend({

    if: function() {
        return this.toATopic &&
               this.ns['http://jabber.org/protocol/disco#info'];
    },

    then: function(cb) {
        var topicSlug = this.request.attrs.to.split('@')[0];

        this.core.topics.slug(topicSlug, function(err, topic) {
            if (err) {
                return cb(err);
            }

            if (!topic) {
                return this.doesNotExist(cb);
            }

            this.sendInfo(topic, cb);

        }.bind(this));
    },

    sendInfo: function(topic, cb) {
        var stanza = this.Iq();

        var query = stanza.c('query', {
            xmlns: 'http://jabber.org/protocol/disco#info'
        });

        query.c('identity', {
            category: 'conference',
            type: 'text',
            name: topic.name
        });

        query.c('feature', {
            var: 'http://jabber.org/protocol/muc'
        });

        query.c('feature', {
            var: 'muc_persistent'
        });

        query.c('feature', {
            var: 'muc_open'
        });

        query.c('feature', {
            var: 'muc_unmoderated'
        });

        query.c('feature', {
            var: 'muc_nonanonymous'
        });

        query.c('feature', {
            var: 'muc_unsecured'
        });

        cb(null, stanza);
    },

    doesNotExist: function(cb) {
        var stanza = this.Iq();

        var query = stanza.c('query', {
            xmlns: 'http://jabber.org/protocol/disco#info'
        });

        query.c('error', {
            type: 'cancel'
        }).c('item-not-found', {
            xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas'
        });

        cb(null, stanza);
    }

});
