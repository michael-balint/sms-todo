'use strict';

// npm modules
const _ = require('lodash');
const async = require('async');
const moment = require('moment');

// local js libraries
const sms = require('./lib/sms.js');
const dynamo = require('./lib/dynamo.js');
const plivo = require('./lib/plivo.js');

// load and set config files
const config = require('./config.json');

// Serverless function (GET)
module.exports.handler = (event, context, callback) => {

  if (event.To.toString() !== config.PHONE) { // validates SMS parameters

    if (event.From.toString() == config.PHONE) { // initiates new user onboarding

      let messageParams = {
        'src': config.PHONE,
        'dst': event.To.toString(),
        'text': "Hello! My name is Woodhouse, welcome to my private beta. I'm here to help manage all your todos. To get started, I'm going to ask a few quick questions. What's your name?"
      }

      return plivo.sendMessage (messageParams, callback);

    } else {

      console.log(event, config);
      return callback(new Error("Invalid input."));
    }
  } else {

    let inputText = event.Text;
    let userPhone = event.From.toString();

    async.waterfall([
      (next) => { // locate the user or create a new one

        let params = {
          phone: userPhone,
          inputText: inputText
        };

        return dynamo.searchForItem(params, 'users', next);

      },
      (userData, next) => { // run through initialSetup or handleMessage

        if (userData.NewUser == true) { return sms.initialSetup(inputText, userData, next); }

        else {

          // CREATE todo
          if (inputText.search(/remind me to /gi) >= 0) { return sms.createTodo(inputText, userData, next); }

          // LIST todo
          else if (inputText.search(/list /gi) >= 0) { return sms.listTodo(inputText, userData, next); }

          // EDIT todo
          else if (inputText.search(/edit /gi) >= 0) { return sms.editTodo(inputText, userData, next); }

          // DELETE (remove) todo
          else if (inputText.search(/delete /gi) >= 0) { return sms.removeTodo(inputText, userData, next); }
          
          // UPDATE settings
          else if (inputText.search(/name /gi) >= 0 ||
                      inputText.search(/time zone /gi) >= 0 ||
                      inputText.search(/daily reminder time /gi) >= 0) { return sms.updateSettings(inputText, userData, next); }

          // INITIAL SETUP and other use cases
          else { return sms.processMessage(inputText, userData, next); }

        }
      },
      (messageText, next) => { // send response SMS

        let messageParams = {
          'src': config.PHONE,
          'dst': userPhone,
          'text': messageText
        };

        return plivo.sendMessage(messageParams, next);

      }
    ], (err, response) => {
      return callback(err, response);
    });
  }
};
