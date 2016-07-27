// twilio.js
// =============

var twilioCreds = require("../twilio-creds.json");
var twilio = require('twilio');
var client = twilio(twilioCreds.account_sid, twilioCreds.auth_token);

// returns an error if invalid
function validateMessage(params, callback) {
  // params = {
  //   To
  //   From
  //   Text
  //   Type
  //   MessageUUID
  // }

  // skip validation if we are in offline mode
  if (process.env.IS_OFFLINE || process.env.SERVERLESS_STAGE === 'dev') {
    return callback(null, {"status": "Valid"});
  }

  if (!params.MessageSid) {
    return callback(new Error(`Invalid 'MessageSid' field.`), {"status": "Invalid"});
  }
  if (!params.From) {
    return callback(new Error(`Invalid 'From' field.`), {"status": "Invalid"});
  }
  if (!params.To) {
    return callback(new Error(`Invalid 'To' field.`), {"status": "Invalid"});
  }
  console.log(`Verifying message with sid ${params.MessageSid}.`);
  client.getMessage(params.MessageSid, (err, response) => {
    if (err) {
      return callback(new Error(
        `Error when validating message: ${JSON.stringify(err)}.`
      ), {"status": "Invalid"});
    }

    const sid = response.sid;
    const direction = response.direction;
    const message_type = response.message_type;
    const from_number = response.from_number;
    const to_number = response.to_number;

    if (
      sid !== params.MessageSid ||
      direction !== "inbound"
    ) {
      return callback(new Error(
        `Mismatch when validating message: ${JSON.stringify(response)}`
      ));
    }

    // successfully validated
    return callback(null, {"status": "Valid"});
  });
}

function sendMessage(params, callback) {
  client.sendMessage(params, (err, response) => {
    if (err) {
      return callback(new Error("Twilio Error"));
    }
    // var resp = new twilio.TwimlResponse();
    // resp.say(params.body);
    return callback(null, params);
  });
}

module.exports = {
  validateMessage,
  sendMessage
}
