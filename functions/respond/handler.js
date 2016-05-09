'use strict';

const _ = require('lodash');
const async = require('async');
const Plivo = require('plivo');
const AWS = require('aws-sdk');

const config = require('./config.json');
const plivoCreds = require('./plivo-creds.json');

const plivo = Plivo.RestAPI(plivoCreds);

let db = new AWS.DynamoDB.DocumentClient();

module.exports.handler = (event, context, callback) => {

  if (event.To !== config.PHONE) {
    console.log(event, config);
    return callback(new Error("Invalid input."));
  }

  let userPhone = event.From;
  let inputText = event.Text;

  async.waterfall([
    (next) => {
      let userParams = {
        phone: userPhone
      };
      return getUserData(userParams, next);
    },
    (userData, next) => {
      return handleMessage(inputText, userData, next);
    },
    (messageText, next) => {
      let messageParams = {
        'src': config.PHONE,
        'dst': userPhone,
        'text': messageText
      };
      return sendMessage(messageParams, next);
    }
  ], (err, response) => {
    return callback(err, response);
  });

};

const getUserData = (params, callback) => {

  db.get({
    "TableName": config.DB_TABLE_NAME,
    "Key": {
      "Phone": params.phone
    }
  }, (err, data) => {
    if (err) { return callback(err); }
    let userData = _.defaults(data, {
      "Phone": params.phone,
      "Name": params.name,
      "TimeZone": params.time_zone,
      "ReminderTime": params.reminder_time,
      "Todos": {}
    });

    return callback(null, userData);
  });

};

const storeUserData = (userData, callback) => {

  db.put({
    "TableName": config.DB_TABLE_NAME,
    "Item": userData
  }, (err, data) => {

    return callback(err, data);
  });

};

// should be refactored to handle general commands post setup
const handleMessage = (inputText, userData, callback) => {

  let parsedInputText = inputText.replace(/\+/g, " ");

  if (!userData.Name) {
    if (parsedInputText.search(/my name is /gi) >= 0) {
      userData.Name = parsedInputText.replace(/my name is /gi, "");
      storeUserData(userData, (err, data) => {
        // TODO: handle error
        return callback(null, `Hello ${userData.Name}!`);
      });
    } else {
      let message = "Let's get you set up! What is your name? Respond with \"My name is <name>\"";
      return callback(null, message);
    }
  } else {
    if (parsedInputText.search(/help/gi) >= 0) {
      return callback(null, "help");
    } else {
      return callback(null, "punt");
    }
  }

};

const sendMessage = (params, callback) => {

  plivo.send_message(params, (status, response) => {
    // TODO: handle status + errors
    callback(null, response);
  });

};
