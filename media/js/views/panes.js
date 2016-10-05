/*
 * TABS/PANES VIEW
 */

'use strict';

+function(window, $, _) {

    window.LCB = window.LCB || {};

    window.LCB.TabsView = Backbone.View.extend({
        events: {
            'click .lcb-tab-close': 'leave'
        },
        focus: true,
        initialize: function(options) {
            this.client = options.client;
            this.template = Handlebars.compile($('#template-topic-tab').html());
            this.topics = options.topics;
            // Topic joining
            this.topics.on('change:joined', function(topic, joined) {
                if (joined) {
                    this.add(topic.toJSON());
                    return;
                }
                this.remove(topic.id);
            }, this);
            // Topic meta updates
            this.topics.on('change:name change:description', this.update, this);
            // Current topic switching
            this.topics.current.on('change:id', function(current, id) {
                this.switch(id);
                this.clearAlerts(id);
            }, this);
            // Alerts
            this.topics.on('messages:new', this.alert, this);
            // Initial switch since router runs before view is loaded
            this.switch(this.topics.current.get('id'));
            // Blur/Focus events
            $(window).on('focus blur', _.bind(this.onFocusBlur, this));
            this.render();
        },
        add: function(topic) {
            this.$el.append(this.template(topic));
        },
        remove: function(id) {
            this.$el.find('.lcb-tab[data-id=' + id + ']').remove();
        },
        update: function(topic) {
            this.$el.find('.lcb-tab[data-id=' + topic.id + '] .lcb-tab-title').text(topic.get('name'));
        },
        switch: function(id) {
            if (!id) {
                id = 'list';
            }
            this.$el.find('.lcb-tab').removeClass('selected')
                .filter('[data-id=' + id + ']').addClass('selected');
        },
        leave: function(e) {
            e.preventDefault();
            var id = $(e.currentTarget).closest('[data-id]').data('id');
            this.client.events.trigger('topics:leave', id);
        },
        alert: function(message) {
            var $tab = this.$('.lcb-tab[data-id=' + message.topic.id + ']'),
                $total = $tab.find('.lcb-tab-alerts-total'),
                $mentions = $tab.find('.lcb-tab-alerts-mentions');
            if (message.historical || $tab.length === 0
                    || ((this.topics.current.get('id') === message.topic.id) && this.focus)) {
                // Nothing to do here!
                return;
            }
            var total = parseInt($tab.data('count-total')) || 0,
                mentions = parseInt($tab.data('count-mentions')) || 0;
            // All messages
            $tab.data('count-total', ++total);
            $total.text(total);
            // Just mentions
            if (new RegExp('\\B@(' + this.client.user.get('username') + ')(?!@)\\b', 'i').test(message.text)) {
                $tab.data('count-mentions', ++mentions);
                $mentions.text(mentions);
            }
        },
        clearAlerts: function(id) {
            var $tab = this.$('.lcb-tab[data-id=' + id + ']'),
                $total = $tab.find('.lcb-tab-alerts-total'),
                $mentions = $tab.find('.lcb-tab-alerts-mentions');
            $tab.data('count-total', 0).data('count-mentions', 0);
            $total.text('');
            $mentions.text('');
        },
        onFocusBlur: function(e) {
            var that = this;
            this.focus = (e.type === 'focus');
            clearTimeout(this.clearTimer);
            if (this.focus) {
                this.clearTimer = setTimeout(function() {
                    that.clearAlerts(that.topics.current.get('id'));
                }, 1000);
                return;
            }
            that.clearAlerts(that.topics.current.get('id'));
        }
    });

    window.LCB.PanesView = Backbone.View.extend({
        initialize: function(options) {
            this.client = options.client;
            this.template = Handlebars.compile($('#template-topic').html());
            this.topics = options.topics;
            this.views = {};
            this.topics.on('change:joined', function(topic, joined) {
                if (joined) {
                    this.add(topic);
                    return;
                }
                this.remove(topic.id);
            }, this);
            // Switch topic
            this.topics.current.on('change:id', function(current, id) {
                this.switch(id);
            }, this);
            // Initial switch since router runs before view is loaded
            this.switch(this.topics.current.get('id'));
        },
        switch: function(id) {
            if (!id) {
                id = 'list';
            }
            var $pane = this.$el.find('.lcb-pane[data-id=' + id + ']');
            $pane.removeClass('hide').siblings().addClass('hide');
            $(window).width() > 767 && $pane.find('[autofocus]').focus();
            this.views[id] && this.views[id].scrollMessages(true);
        },
        add: function(topic) {
            if (this.views[topic.id]) {
                // Nothing to do, this topic is already here
                return;
            }
            this.views[topic.id] = new window.LCB.TopicView({
                client: this.client,
                template: this.template,
                model: topic
            });
            this.$el.append(this.views[topic.id].$el);
        },
        remove: function(id) {
            if (!this.views[id]) {
                // Nothing to do here
                return;
            }
            this.views[id].destroy();
            delete this.views[id];
        }
    });

}(window, $, _);
