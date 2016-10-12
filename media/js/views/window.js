/*
 * WINDOW VIEW
 * TODO: Break it up :/
 */

'use strict';

+function(window, $, _, notify) {

    window.LCB = window.LCB || {};

    window.LCB.WindowView = Backbone.View.extend({
        el: 'html',
        focus: true,
        count: 0,
        mentions: 0,
        countFavicon: new Favico({
            position: 'down',
            animation: 'none',
            bgColor: '#b94a48'
        }),
        mentionsFavicon: new Favico({
            position: 'left',
            animation: 'none',
            bgColor: '#f22472'
        }),
        initialize: function(options) {

            var that = this;

            this.client = options.client;
            this.topics = options.topics;
            this.originalTitle = document.title;
            this.title = this.originalTitle;

            $(window).on('focus blur', _.bind(this.onFocusBlur, this));

            this.topics.current.on('change:id', function(current, id) {
                var topic = this.topics.get(id),
                    title = topic ? topic.get('name') : 'Topics';
                this.updateTitle(title);
            }, this);

            this.topics.on('change:name', function(topic) {
                if (topic.id !== this.topics.current.get('id')) {
                    return;
                }
                this.updateTitle(topic.get('name'));
            }, this);

            this.topics.on('messages:new', this.onNewMessage, this);

            // Last man standing
            _.defer(function() {
                that.updateTitle();
            });

        },
        onFocusBlur: function(e) {
            this.focus = (e.type === 'focus');
            if (this.focus) {
                clearInterval(this.titleTimer);
                clearInterval(this.faviconBadgeTimer);
                this.count = 0;
                this.mentions = 0;
                this.titleTimer = false;
                this.titleTimerFlip = false;
                this.faviconBadgeTimer = false;
                this.faviconBadgeTimerFlip = false;
                this.updateTitle();
                this.mentionsFavicon.reset();
            }
        },
        onNewMessage: function(message) {
            if (this.focus || message.historical || message.owner.id === this.client.user.id) {
                return;
            }
            this.countMessage(message);
            this.flashTitle()
            this.flashFaviconBadge();
        },
        countMessage: function(message) {
            ++this.count;
            message.mentioned && ++this.mentions;
        },
        flashTitle: function() {
            var titlePrefix = '';
            if (this.count > 0) {
                titlePrefix += '(' + parseInt(this.count);
                if (this.mentions > 0) {
                    titlePrefix += '/' + parseInt(this.mentions) + '@';
                }
                titlePrefix += ') ';
            }
            document.title = titlePrefix + this.title;
        },
        flashFaviconBadge: function() {
            if (!this.faviconBadgeTimer) {
                this._flashFaviconBadge();
                var flashFaviconBadge = _.bind(this._flashFaviconBadge, this);
                this.faviconBadgeTimer = setInterval(flashFaviconBadge, 1 * 2000);
            }
        },
        _flashFaviconBadge: function() {
            if (this.mentions > 0 && this.faviconBadgeTimerFlip) {
                this.mentionsFavicon.badge(this.mentions);
            } else {
                this.countFavicon.badge(this.count);
            }
            this.faviconBadgeTimerFlip = !this.faviconBadgeTimerFlip;
        },
        updateTitle: function(name) {
            if (!name) {
                var topic = this.topics.get(this.topics.current.get('id'));
                name = (topic && topic.get('name')) || 'Topics';
            }
            if (name) {
                this.title = name + ' \u00B7 ' + this.originalTitle;
            } else {
                this.title = this.originalTitle;
            }
            document.title = this.title;
        }
    });

    window.LCB.HotKeysView = Backbone.View.extend({
        el: 'html',
        keys: {
            'up+shift+alt down+shift+alt': 'nextTopic',
            's+shift+alt': 'toggleTopicSidebar',
            'g+shift+alt': 'openGiphyModal',
            'space+shift+alt': 'recallTopic'
        },
        initialize: function(options) {
            this.client = options.client;
            this.topics = options.topics;
        },
        nextTopic: function(e) {
            var method = e.keyCode === 40 ? 'next' : 'prev',
                selector = e.keyCode === 40 ? 'first' : 'last',
                $next = this.$('.lcb-tabs').find('[data-id].selected')[method]();
            if ($next.length === 0) {
                $next = this.$('.lcb-tabs').find('[data-id]:' + selector);
            }
            this.client.events.trigger('topics:switch', $next.data('id'));
        },
        recallTopic: function() {
            this.client.events.trigger('topics:switch', this.topics.last.get('id'));
        },
        toggleTopicSidebar: function(e) {
            e.preventDefault();
            var view = this.client.view.panes.views[this.topics.current.get('id')];
            view && view.toggleSidebar && view.toggleSidebar();
        },
        openGiphyModal: function(e) {
            if (this.client.options.giphyEnabled) {
                e.preventDefault();
                $('.lcb-giphy').modal('show');
            }
        }
    });

}(window, $, _, notify);
