"use strict";

const AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
const db = new AWS.DynamoDB.DocumentClient();

const config = require('../functions/respond/config.json');
const moment = require('moment');
const program = require('commander');
const momentTZ = require('moment-timezone');
const SendAlerts = require('./send_alerts');

const SEND_CONCURRENCY = 10;

class SendDailyAlerts extends SendAlerts {

  static getAlerts(utcDateTime, callback) {
    // TODO(Stroup): query dynamo for alerts

    // QUERY all users with a specific time > grab the Todos
    // grab the TOP 5 (initially the first 5)
    // send as message (via alert)

    console.log(utcDateTime._d);

    let params = {
      TableName : config.DB_TABLE_NAME,
      KeyConditionExpression: "DailyReminderTime = :drt",
      ExpressionAttributeValues: {
          ":drt":utcDateTime
      }
    };

    db.query(params, function(err, data) {
        if (err) {
            console.error("Unable to QUERY daily reminder time. Error:", JSON.stringify(err, null, 2));
        } else {
            console.log("Daily reminder time QUERY successful.");

            // return TOP 5 todos
            data.Items.forEach(function(item) {
                console.log(item.Todos);
            });
        }
    });

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

SendDailyAlerts.sendAlerts(utcDateTime);
