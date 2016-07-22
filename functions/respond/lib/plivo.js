// plivo.js
// =============

var Plivo = require('plivo');
var plivoCreds = require('../plivo-creds.json');
var plivo = Plivo.RestAPI(plivoCreds);

// returns (err, response) - where response.status === "Valid" if valid
function validateMessage(params, callback) {
  // params = {
  //   To
  //   From
  //   Text
  //   Type
  //   MessageUUID
  // }

  // skip validation if we are in offline mode
  if (process.env.IS_OFFLINE) {
    return callback(null, { status: "Valid" });
  }
  if (!params.MessageUUID) {
    return callback(new Error(`Invalid 'uuid' field in message.`, { status: "Invalid" }));
  }
  if (!params.From) {
    return callback(new Error(`Invalid 'from' field in message.`, { status: "Invalid" }));
  }
  if (!params.To) {
    return callback(new Error(`Invalid 'to' field in message.`, { status: "Invalid" }));
  }
  plivo.get_message({record_id: params.MessageUUID}, (status, response) => {
    if (status !== 202 && status !== 200) {
      return callback(new Error(
        `Plivo error when validating message: ${JSON.stringify(response)}`
      ), { status: "Invalid" });
    }

    const message_state = response.message_state;
    const message_direction = response.message_direction;
    const message_type = response.message_type;
    const from_number = response.from_number;
    const to_number = response.to_number;

    if (message_state !== "delivered" ||
        message_direction !== "inbound" ||
        message_type !== "sms" ||
        from_number !== params.From.toString() ||
        to_number !== params.To.toString()
    ) {
      return callback(new Error(
        `Plivo mismatch when validating message: ${JSON.stringify(response)}`
      ), { status: "Invalid" });
    }

    // successfully validated
    return callback(null, { status: "Valid" });
  });
}

function sendMessage(params, callback) {
  plivo.send_message(params, (status, response) => {
    if (status !== 202 && status !== 200) {
      console.error("Plivo error:", status);
    }
    return callback(null, JSON.stringify(response, null, 2));
  });
}

module.exports = {
  validateMessage,
  sendMessage
}
