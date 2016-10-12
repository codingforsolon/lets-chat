/*
 * TABS/PANES VIEW
 */

'use strict';

+function(window, $, _) {

    window.LCB = window.LCB || {};

    window.LCB.PanesView = Backbone.View.extend({
        initialize: function(options) {
            this.client = options.client;
            this.template = Handlebars.compile($('#template-topic').html());
            this.topic = options.topic;
            this.topic.on('change:joined', function(topic, joined) {
                if (joined) {
                    this.add(topic);
                    return;
                }
                this.remove(topic.id);
            }, this);
        },
        add: function(topic) {
            var tv = new window.LCB.TopicView({
                client: this.client,
                template: this.template,
                model: topic
            });
            console.log('------tv el');
            console.log(this.$el);
            console.log(tv.$el);
            this.$el.append(tv.$el);
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
