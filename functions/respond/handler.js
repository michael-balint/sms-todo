'use strict';

const sms = require('./lib/sms.js');
const twilio = require('./lib/twilio.js');

// Serverless function (GET)
module.exports.handler = (event, context, callback) => {
  console.log(`Received message: ${JSON.stringify(event)}`);

  // TODO: add twilio.validateMessage call and refactor the following into submethods...
  twilio.validateMessage(event, (err, response) => {
    if (response.status === "Valid") {
      return sms.handleMessage(event, callback);
    } else {
      return callback(new Error("Message must be sent from a mobile device."));
    }
  });
};
