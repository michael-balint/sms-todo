'use strict';

// var AWS = require('aws-sdk');
// AWS.config.update({region:'us-east-1'});
// var db = new AWS.DynamoDB.DocumentClient();
const plivo = require('../functions/respond/lib/plivo');
const async = require('async');
const moment = require('moment');

const SEND_CONCURRENCY = 10;

class SendAlerts {

  static getAlerts(utcDateTime, callback) {
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

  static sendAlert(alert, callback) {
    plivo.sendMessage(alert, (err) => {
      // TODO(Balint): log this using a log library
      if(err) {
        console.error(err);
      } else {
        console.log(`Sent message to ${alert.dst} with message ${alert.text}`);
      }
    });
  }

  static sendAlerts(utcDateTime) {
    async.waterfall([
      (next) => {
        console.log(`Sending alerts for ${utcDateTime}...`);
        this.getAlerts(utcDateTime, next);
      },
      (alerts, next) => {
        async.eachLimit(alerts, SEND_CONCURRENCY, this.sendAlert, next);
      }
    ], (err) => {
      console.log("Finished sending daily alerts.");
    });
  }

}

module.exports = SendAlerts;
