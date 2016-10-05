//
// Require Login
//

'use strict';

var mongoose = require('mongoose');

module.exports = function(req, res, next) {
    var topic = req.params.topic;

    if (!topic) {
        return res.sendStatus(404);
    }

    var Topic = mongoose.model('Topic');

    Topic.findByIdOrSlug(topic, function(err, topic) {
        if (err) {
            return res.sendStatus(400);
        }

        if (!topic) {
            return res.sendStatus(404);
        }

        var topicId = topic._id.toString();

        req.params.topic = topicId;
        req.body.topic = topicId;
        req.query.topic = topicId;

        next();
    });
};
