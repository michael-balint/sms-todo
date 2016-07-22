// twilio.js
// =============

var twilioCreds = require("../twilio-creds.json");
var twilio = require('twilio');
var client = twilio(twilioCreds.account_sid, twilioCreds.auth_token);

// returns (err, response) - where response.status === "Valid" if valid
function validateMessage(params, callback) {
  return callback(null, { status: "Valid" });
}

function sendMessage(params, callback) {
  client.sendMessage(params, (err, response) => {
    if (err) {
      return callback(new Error("Twilio Error"));
    }
    // var resp = new twilio.TwimlResponse();
    // resp.say(params.body);
    return callback(null, params.body);
  });
}

module.exports = {
  validateMessage,
  sendMessage
}
