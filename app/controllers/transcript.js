//
// Transcript Controller
//

'use strict';

module.exports = function() {
    var app = this.app,
        core = this.core,
        middlewares = this.middlewares;

    //
    // Routes
    //
    app.get('/transcript', middlewares.requireLogin, function(req, res) {
        var topicId = req.param('topic');
        core.topics.get(topicId, function(err, topic) {
            if (err) {
                console.error(err);
                return res.sendStatus(404);
            }

            if (!topic) {
                return res.sendStatus(404);
            }

            res.render('transcript.html', {
                topic: {
                    id: topicId,
                    name: topic.name
                }
            });
        });
    });
};
