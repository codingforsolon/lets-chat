//= require vendor/bootstrap-daterangepicker/daterangepicker.js
//= require util/message.js
//= require views/transcript.js

$(function() {
    var transcript = new window.LCB.TranscriptView({
        el: '.lcb-transcript',
        topic: {
            id: $('[name="topic-id"]').val(),
            name: $('[name="topic-name"]').val()
        }
    });
});
