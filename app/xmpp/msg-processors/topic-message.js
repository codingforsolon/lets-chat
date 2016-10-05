'use strict';

var _ = require('lodash'),
    MessageProcessor = require('./../msg-processor');

var mentionPattern = /^([a-z0-9_]+\:)\B/;

module.exports = MessageProcessor.extend({

    if: function() {
        return this.request.name === 'message' &&
               this.request.type === 'groupchat' &&
               this.toATopic;
    },

    then: function(cb) {
        var topicSlug = this.request.attrs.to.split('@')[0];

        var body = _.find(this.request.children, function (child) {
            return child.name === 'body';
        });

        if (!body) {
            return cb();
        }

        this.core.topics.slug(topicSlug, function(err, topic) {
            if (err) {
                return cb(err);
            }

            if (!topic) {
                return cb();
            }

            var text = body.text().replace(mentionPattern, function(group) {

                var usernames = this.core.presence.topics
                                    .get(topic._id).getUsernames();

                var username = group.substring(0, group.length - 1);

                if (usernames.indexOf(username) > -1) {
                    return '@' + username;
                }

                return group;

            }.bind(this));


            var options = {
                owner: this.client.user._id,
                topic: topic._id,
                text: text,
                data: {
                    id: this.request.attrs.id
                }
            };

            this.core.messages.create(options, function(err) {
                // Message will be sent by listener
                cb(err);
            });

        }.bind(this));
    }

});
