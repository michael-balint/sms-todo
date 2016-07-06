// plivo.js
// =============

var Plivo = require('plivo');
var plivoCreds = require('../plivo-creds.json');
var plivo = Plivo.RestAPI(plivoCreds);

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
  // if (process.env.IS_OFFLINE) {
  //   return callback();
  // }
  if (!params.MessageUUID) {
    return callback(new Error(`Invalid 'uuid' field in message.`));
  }
  if (!params.From) {
    return callback(new Error(`Invalid 'from' field in message.`));
  }
  if (!params.To) {
    return callback(new Error(`Invalid 'to' field in message.`));
  }
  plivo.get_message({record_id: params.MessageUUID}, (status, response) => {
    if (status !== 202 && status !== 200) {
      return callback(new Error(
        `Plivo error when validating message: ${JSON.stringify(response)}`
      ));
    }

    const {
      message_state, message_direction, message_type, from_number, to_number
    } = response;

    if (message_state !== "delivered" ||
        message_direction !== "inbound" ||
        message_type !== "sms" ||
        from_number !== params.From.toString() ||
        to_number !== params.To.toString()
    ) {
      return callback(new Error(
        `Plivo mismatch when validating message: ${JSON.stringify(response)}`
      ));
    }

    // successfully validated
    return callback();
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
