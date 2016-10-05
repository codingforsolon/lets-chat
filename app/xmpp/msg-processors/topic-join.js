'use strict';

var _ = require('lodash'),
    moment = require('moment'),
    Message = require('node-xmpp-server').Message,
    MessageProcessor = require('./../msg-processor'),
    settings = require('./../../config');

module.exports = MessageProcessor.extend({

    if: function() {
        var topicPresense = this.toATopic &&
               !this.request.type &&
               this.request.name === 'presence';

        if (!topicPresense) {
            return false;
        }

        var toParts = this.request.attrs.to.split('/'),
            topicUrl = toParts[0],
            topicSlug = topicUrl.split('@')[0];

        var ptopic = this.core.presence.topics.slug(topicSlug);

        if (ptopic && ptopic.connections.contains(this.connection)) {
            // If this connection is already in the topic
            // then no need to run this message processor
            return false;
        }

        return true;
    },

    then: function(cb) {
        var toParts = this.request.attrs.to.split('/'),
            topicUrl = toParts[0],
            nickname = toParts[1],
            topicSlug = topicUrl.split('@')[0];

        this.connection.nickname(topicSlug, nickname);

        var options = {
            userId: this.connection.user.id,
            slug: topicSlug,
            password: this.getPassword(),
            saveMembership: true
        };

        this.core.topics.canJoin(options, function(err, topic, canJoin) {
            if (err) {
                return cb(err);
            }

            if (topic && canJoin) {
                return this.handleJoin(topic, cb);
            }

            if (topic && !canJoin) {
                return this.sendErrorPassword(topic, cb);
            }

            if (!settings.xmpp.topicCreation) {
                return this.cantCreateTopic(topicSlug, cb);
            }

            return this.createTopic(topicSlug, function(err, topic) {
                if (err) {
                    return cb(err);
                }
                this.handleJoin(topic, cb);
            }.bind(this));

        }.bind(this));
    },

    createTopic: function(topicSlug, cb) {
        var password = this.getPassword();
        var options = {
            owner: this.connection.user.id,
            name: topicSlug,
            slug: topicSlug,
            description: '',
            password: password
        };
        if(!settings.topics.private) {
            delete options.private;
            delete options.password;
        }
        this.core.topics.create(options, cb);
    },

    cantCreateTopic: function(topicSlug, cb) {
        var presence = this.Presence({
            from: this.connection.getTopicJid(topicSlug, 'admin'),
            type: 'error'
        });

        presence.c('x', {
            xmlns: 'http://jabber.org/protocol/muc'
        });

        presence.c('error', {
            by: this.connection.getTopicJid(topicSlug),
            type: 'cancel'
        }).c('not-allowed', {
            xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas'
        });

        cb(null, presence);
    },

    _getXNode: function() {
        if(!this.xNode) {
            this.xNode = _.find(this.request.children, function(child) {
                return child.name === 'x';
            });
        }
        return this.xNode;
    },

    getHistoryNode: function() {
        var xNode = this._getXNode();
        if (xNode) {
            return _.find(xNode.children, function(child) {
                return child.name === 'history';
            });
        }
    },

    getPassword: function() {
        var xNode = this._getXNode();
        if (xNode) {
            var passwordNode = _.find(xNode.children, function(child) {
                return child.name === 'password';
            });
            if(passwordNode && passwordNode.children) {
                return passwordNode.children[0];
            }
        }

        return '';
    },

    sendErrorPassword: function(topic, cb) {
        //from http://xmpp.org/extensions/xep-0045.html#enter-pw
        var presence = this.Presence({
            type: 'error'
        });

        presence
            .c('x', {
                xmlns: 'http://jabber.org/protocol/muc'
            });
        presence
            .c('error', {
                type: 'auth',
                by: this.connection.getTopicJid(topic.slug)
            })
            .c('not-authorized', {
                xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas'
            });

        return cb(null, presence);
    },

    handleJoin: function(topic, cb) {
        var username = this.connection.user.username;

        var ptopic = this.core.presence.topics.get(topic._id);
        var usernames = ptopic ? ptopic.getUsernames() : [];

        // User's own presence must be last - and be their nickname
        var i = usernames.indexOf(username);
        if (i > -1) {
            usernames.splice(i, 1);
        }
        usernames.push(this.connection.user.username);

        var presences = usernames.map(function(username) {

            var presence = this.Presence({
                from: this.connection.getTopicJid(topic.slug, username)
            });

            presence
                .c('x', {
                    xmlns: 'http://jabber.org/protocol/muc#user'
                })
                .c('item', {
                    jid: this.connection.getUserJid(username),
                    affiliation: 'none',
                    role: 'participant'
                });

            // TODO: Add avatar for each topic user
            // helper.populateVcard(presence, user, this.core);

            return presence;

        }, this);

        var subject = this.Message({
            type: 'groupchat'
        });

        subject.c('subject').t(topic.name + ' | ' + topic.description);

        var historyNode = this.getHistoryNode();

        if (!historyNode ||
            historyNode.attrs.maxchars === 0 ||
            historyNode.attrs.maxchars === '0') {
                // Send no history
                this.core.presence.join(this.connection, topic);
                return cb(null, presences, subject);
        }

        var query = {
            userId: this.connection.user.id,
            topic: topic._id,
            expand: 'owner'
        };

        if (historyNode.attrs.since) {
            query.from = moment(historyNode.attrs.since).utc().toDate();
        }

        if (historyNode.attrs.seconds) {
            query.from = moment()
                .subtract(historyNode.attrs.seconds, 'seconds')
                .utc()
                .toDate();
        }

        if (historyNode.attrs.maxstanzas) {
            query.take = historyNode.attrs.maxstanzas;
        }

        this.core.messages.list(query, function(err, messages) {
            if (err) {
                return cb(err);
            }

            messages.reverse();

            var msgs = messages.map(function(msg) {

                var stanza = new Message({
                    id: msg._id,
                    type: 'groupchat',
                    to: this.connection.getTopicJid(topic.slug),
                    from: this.connection.getTopicJid(topic.slug, msg.owner.username)
                });

                stanza.c('body').t(msg.text);

                stanza.c('delay', {
                    xmlns: 'urn:xmpp:delay',
                    from: this.connection.getTopicJid(topic.slug),
                    stamp: msg.posted.toISOString()
                });

                stanza.c('addresses', {
                    xmlns: 'http://jabber.org/protocol/address'
                }).c('address', {
                    type: 'ofrom',
                    jid: this.connection.getUserJid(msg.owner.username)
                });

                return stanza;

            }, this);

            this.core.presence.join(this.connection, topic);
            cb(null, presences, msgs, subject);

        }.bind(this));
    }

});
