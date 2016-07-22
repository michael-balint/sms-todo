'use strict';

const sms = require('./lib/sms.js');
const plivo = require('./lib/plivo.js');

// Serverless function (GET)
module.exports.handler = (event, context, callback) => {

  // TODO: add plivo.validateMessage call and refactor the following into submethods...
  plivo.validateMessage(event, (err, response) => {
    if (response.status === "Valid") {
      return sms.handleMessage(event, callback);
    } else {
      return callback(new Error("Message must be sent from a mobile device."));
    }
  });
};
