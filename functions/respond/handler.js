'use strict';

// npm modules
const _ = require('lodash');
const async = require('async');
const moment = require('moment');

// local js libraries
const sms = require('./lib/sms.js');
const userTable = require('./lib/user.js');
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

        return userTable.searchForUserData(params, next);

      },
      (userData, next) => { // run through initialSetup or handleMessage

        if (userData.NewUser == true) {
          return sms.initialSetup(inputText, userData, next);
        } else {

          let parsedInputText = inputText.replace(/\+/g, " ").toString().toLowerCase();

          if (parsedInputText.search(/remind me to /gi) >= 0) { // create todo
            return sms.createTodo(parsedInputText, userData, next);
          } else if (parsedInputText.search(/list /gi) >= 0) { // list todos
            return sms.listTodo(parsedInputText, userData, next);
          } else if (parsedInputText.search(/edit /gi) >= 0) { // edit todo
            return sms.editTodo(parsedInputText, userData, next);
          } else if (parsedInputText.search(/delete /gi) >= 0) { // delete (remove) todo
            return sms.removeTodo(parsedInputText, userData, next);
          } else if (inputText.search(/name /gi) >= 0 || inputText.search(/time zone /gi) >= 0 || inputText.search(/daily reminder time /gi) >= 0) { // update settings
            return sms.updateSettings(inputText, userData, next);
          } else {
            return sms.processMessage(inputText, userData, next);
          }

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
