'use strict';

const sms = require('./lib/sms.js');
const twilio = require('./lib/twilio.js');

// Serverless function (GET)
module.exports.handler = (event, context, callback) => {
  var params = event.body;

  // TODO: add twilio.validateMessage call and refactor the following into submethods...
  twilio.validateMessage(params, (err, response) => {
    if (response.status === "Valid") {
      return sms.handleMessage(params, callback);
    } else {
      return callback(new Error("Message must be sent from a mobile device."));
    }
  });
};
