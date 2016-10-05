/*
 * BROWSER VIEW
 * This is the "All Topics" browser!
 */

'use strict';

+function(window, $, _) {

    window.LCB = window.LCB || {};

    window.LCB.BrowserView = Backbone.View.extend({
        events: {
            'submit .lcb-topics-add': 'create',
            'keyup .lcb-topics-browser-filter-input': 'filter',
            'change .lcb-topics-switch': 'toggle',
            'click .lcb-topics-switch-label': 'toggle'
        },
        initialize: function(options) {
            this.client = options.client;
            this.template = Handlebars.compile($('#template-topic-browser-item').html());
            this.userTemplate = Handlebars.compile($('#template-topic-browser-item-user').html());
            this.topics = options.topics;
            this.topics.on('add', this.add, this);
            this.topics.on('remove', this.remove, this);
            this.topics.on('change:description change:name', this.update, this);
            this.topics.on('change:lastActive', _.debounce(this.updateLastActive, 200), this);
            this.topics.on('change:joined', this.updateToggles, this);
            this.topics.on('users:add', this.addUser, this);
            this.topics.on('users:remove', this.removeUser, this);
            this.topics.on('users:add users:remove add remove', this.sort, this);
            this.topics.current.on('change:id', function(current, id) {
                // We only care about the list pane
                if (id !== 'list') return;
                this.sort();
            }, this);
        },
        updateToggles: function(topic, joined) {
            this.$('.lcb-topics-switch[data-id=' + topic.id + ']').prop('checked', joined);
        },
        toggle: function(e) {
            e.preventDefault();
            var $target = $(e.currentTarget),
                $input = $target.is(':checkbox') && $target || $target.siblings('[type="checkbox"]'),
                id = $input.data('id'),
                topic = this.topics.get(id);

            if (!topic) {
                return;
            }

            if (topic.get('joined')) {
                this.client.leaveTopic(topic.id);
            } else {
                this.client.joinTopic(topic);
            }
        },
        add: function(topic) {
            var topic = topic.toJSON ? topic.toJSON() : topic,
                context = _.extend(topic, {
                    lastActive: moment(topic.lastActive).calendar()
                });
            this.$('.lcb-topics-list').append(this.template(context));
        },
        remove: function(topic) {
            this.$('.lcb-topics-list-item[data-id=' + topic.id + ']').remove();
        },
        update: function(topic) {
            this.$('.lcb-topics-list-item[data-id=' + topic.id + '] .lcb-topics-list-item-name').text(topic.get('name'));
            this.$('.lcb-topics-list-item[data-id=' + topic.id + '] .lcb-topics-list-item-description').text(topic.get('description'));
            this.$('.lcb-topics-list-item[data-id=' + topic.id + '] .lcb-topics-list-item-participants').text(topic.get('participants'));
        },
        updateLastActive: function(topic) {
            this.$('.lcb-topics-list-item[data-id=' + topic.id + '] .lcb-topics-list-item-last-active .value').text(moment(topic.get('lastActive')).calendar());
        },
        sort: function(model) {
            var that = this,
                $items = this.$('.lcb-topics-list-item');
            // We only care about other users
            if (this.$el.hasClass('hide') && model && model.id === this.client.user.id)
                return;
            $items.sort(function(a, b){
                var ar = that.topics.get($(a).data('id')),
                    br = that.topics.get($(b).data('id')),
                    au = ar.users.length,
                    bu = br.users.length,
                    aj = ar.get('joined'),
                    bj = br.get('joined');
                if ((aj && bj) || (!aj && !bj)) {
                    if (au > bu) return -1;
                    if (au < bu) return 1;
                }
                if (aj) return -1;
                if (bj) return 1;
                return 0;
            });
            $items.detach().appendTo(this.$('.lcb-topics-list'));
        },
        filter: function(e) {
            e.preventDefault();
            var $input = $(e.currentTarget),
                needle = $input.val().toLowerCase();
            this.$('.lcb-topics-list-item').each(function () {
                var haystack = $(this).find('.lcb-topics-list-item-name').text().toLowerCase();
                $(this).toggle(haystack.indexOf(needle) >= 0);
            });
        },
        create: function(e) {
            var that = this;
            e.preventDefault();
            var $form = this.$(e.target),
                $modal = this.$('#lcb-add-topic'),
                $name = this.$('.lcb-topic-name'),
                $slug = this.$('.lcb-topic-slug'),
                $description = this.$('.lcb-topic-description'),
                $password = this.$('.lcb-topic-password'),
                $confirmPassword = this.$('.lcb-topic-confirm-password'),
                $private = this.$('.lcb-topic-private'),
                data = {
                    name: $name.val().trim(),
                    slug: $slug.val().trim(),
                    description: $description.val(),
                    password: $password.val(),
                    private: !!$private.prop('checked'),
                    callback: function success() {
                        $modal.modal('hide');
                        $form.trigger('reset');
                    }
                };

            $name.parent().removeClass('has-error');
            $slug.parent().removeClass('has-error');
            $confirmPassword.parent().removeClass('has-error');

            // we require name is non-empty
            if (!data.name) {
                $name.parent().addClass('has-error');
                return;
            }

            // we require slug is non-empty
            if (!data.slug) {
                $slug.parent().addClass('has-error');
                return;
            }

            // remind the user, that users may share the password with others
            if (data.password) {
                if (data.password !== $confirmPassword.val()) {
                    $confirmPassword.parent().addClass('has-error');
                    return;
                }

                swal({
                    title: 'Password-protected topic',
                    text: 'You\'re creating a topic with a shared password.\n' +
                          'Anyone who obtains the password may enter the topic.',
                    showCancelButton: true
                }, function(){
                    that.client.events.trigger('topics:create', data);
                });
                return;
            }

            this.client.events.trigger('topics:create', data);
        },
        addUser: function(user, topic) {
            this.$('.lcb-topics-list-item[data-id="' + topic.id + '"]')
                .find('.lcb-topics-list-users').prepend(this.userTemplate(user.toJSON()));
        },
        removeUser: function(user, topic) {
            this.$('.lcb-topics-list-item[data-id="' + topic.id + '"]')
                .find('.lcb-topics-list-user[data-id="' + user.id + '"]').remove();
        }

    });

}(window, $, _);
