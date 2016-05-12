// plivo.js
// =============

var Plivo = require('plivo');
var plivoCreds = require('../plivo-creds.json');
var plivo = Plivo.RestAPI(plivoCreds);

function sendMessage(params, callback) {
  plivo.send_message(params, (status, response) => {
    if (status != 202 && status != 200) {
      console.error("Plivo error:", status);
    }
    return callback(null, JSON.stringify(response, null, 2));
  });
}

module.exports = {
  sendMessage: sendMessage
}