'use strict';

var MessageProcessor = require('./../msg-processor');

module.exports = MessageProcessor.extend({

    if: function() {
        return this.request.name === 'presence' &&
               this.request.type === 'unavailable' &&
               this.toATopic;
    },

    then: function(cb) {
        var topicUrl = this.request.attrs.to.split('/')[0],
            topicSlug = topicUrl.split('@')[0];

        this.core.topics.slug(topicSlug, function(err, topic) {
            if (err) {
                return cb(err);
            }

            if (!topic) {
                return cb();
            }

            this.core.presence.leave(this.client.conn, topic._id);

            var presence = this.Presence({
                type: 'unavailable'
            });

            var x = presence.c('x', {
                xmlns: 'http://jabber.org/protocol/muc#user'
            });
            x.c('item', {
                jid: this.request.attrs.from,
                role: 'none',
                affiliation: 'none'
            });
            x.c('status', {
                code: '110'
            });

            cb(null, presence);

        }.bind(this));
    }

});
