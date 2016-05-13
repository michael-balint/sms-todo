"use strict";

// var AWS = require('aws-sdk');
// AWS.config.update({region:'us-east-1'});
// var db = new AWS.DynamoDB.DocumentClient();
const moment = require('moment');
const program = require('commander');
const SendAlerts = require('./send_alerts');

const SEND_CONCURRENCY = 10;

class SendExplicitAlerts extends SendAlerts {

  static getAlerts(utcDateTime, callback) {
    // TODO(Stroup): query dynamo for alerts

    // alert = {src, dst, text}
    let alerts = [{
      "src": "16572565048",
      "dst": "19186918755",
      "text": "test1"
    }, {
      "src": "16572565048",
      "dst": "19186918755",
      "text": "test2"
    }];

    return callback(null, alerts);
  }

}

/**********************************************************
  MAIN
 **********************************************************/

program
  .version('0.0.1')
  .option('-d, --datetime [unix_seconds]',
    'Send alerts for a specified date/time in unix seconds since epoch.'
  )
  .parse(process.argv);

let unixDateTime = program.datetime;
let utcDateTime = moment.unix(unixDateTime).utc().seconds(0);

SendExplicitAlerts.sendAlerts(utcDateTime);
