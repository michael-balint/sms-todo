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
      if (userData.NewUser == true) {
        return initialSetup(inputText, userData, next);
      } else {
        return handleMessage(inputText, userData, next);
      }
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
      "DailyReminderTime": params.daily_reminder_time,
      "NewUser": params.new_user,
      "Todos": {} // TODO: retrieve all todos
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
  
  // TODO: add in various conditions
  // 1) new task (Remind me ...)
  // 2) list tasks (list)
  // 3) help request (help)
  // 4) change settings (settings)
  // 5) edit task (Edit N)
  
  if (parsedInputText.search(/Remind me /gi) >= 0) {
    parsedInputText.replace(/Remind me /gi, "");
    // TODO: add NLP to parse out the todo text
    // save it to the DB (subject, qty, date/time, importance)
    // may have to ask the user for additional information if not provided
    // will require a nested check to remember the Reminder task
    // reference it to the cron job
  } else if (parsedInputText.search(/Edit /gi) >= 0) {
    let todoNumber = Number(parsedInputText.replace(/Edit /gi, ""));
    // TODO: get list of all todoNumbers associated with user
    if (todoNumber === parseInt(data, 10)) { // add && condition to check if the todoNumber exists 
      // TODO: provide an option to change the various settings (subject, qty, date/time, importance)
      // requires a nested check to remember the Edit task
    } else {
      return callback(null, "Oops! Looks like this todo either doesn't exist or you didn't enter a number. Try again and enter 'Edit N' (where N is an existing todo number).")
    }
  } else {
    switch(parsedInputText.toLowerCase()) {
      case 'help':
        return callback(null, "1) To create a new todo, start a text message with 'Remind me'\n2) To get the list of all your todos, text 'list'\n3) To edit a todo, text 'Edit N' (where N is an existing todo number)\n4) to view your settings type 'settings'");
        break;
      case 'list':
        // TODO: list all tasks (start with top 3) and then provide 'more' option to list more tasks
        break;
      case 'settings':
        // TODO: list the settings and provide an option to edit them
        // potentially requires a nested check to remember the Settings task
        break;
      default:
        return callback(null, "Kato can't help with that or is to dumb to figure it out right now, try typing 'help' to get a list of available options!");
    }
  }

};

const sendMessage = (params, callback) => {

  plivo.send_message(params, (status, response) => {
    // TODO: handle status + errors
    callback(null, response);
  });

};

// invitation to new user, currently has to be a server call
// TODO: create simple dashboard to invite new users and track existing user's usage
const invitation = (userPhone, callback) => {
  
  // create new user in DB
  userData = {
    'Phone': userPhone,
    'newUser': true
  };
  storeUserData(userData, callback);
  
  // send initial welcome email
  let params = {
    'src': config.PHONE, // not sure what this is, related to config.json and believe it's a plivo setting
    'dst': userPhone,
    'text': "Hello! Welcome to the Kato private beta. We're going to ask a few quick questions to get you setup. What's your name?"
  };
  sendResponse(params, callback);
  
};

// initial setup for new user
const initialSetup = (inputText, userData, callback) => {
  
  let parsedInputText = inputText.replace(/\+/g, " ");

  if (!userData.Name) {
    userData.Name = toTitleCase(parsedInputText);
    storeUserData(userData, (err, data) => {
      // TODO: handle error
      return callback(null, `Hello ${userData.Name}! What timezone are you in (e.g. ET, CT, MT, or PT)?`);
    });
  } else if (!userData.TimeZone) {
    userData.TimeZone = parsedInputText.toUpperCase();
    if (userData.TimeZone != 'ET' || userData.TimeZone != 'CT' || userData.TimeZone != 'MT' || userData.TimeZone != 'PT') {
      return callback(null, 'Please reply with one of the four available timezones (e.g. ET, CT, MT, or PT).');
    } else {
      storeUserData(userData, (err, data) => {
        // TODO: handle error
        return callback(null, "Awesome! We send out daily reminders of your top 3 todos (plus more) at 8AM. If you'd like to be reminded at a different time, please reply with the new time (if you don't want to change the daily reminder time reply 'next')?");
      });
    }
  } else if (!userData.DailyReminderTime) {
    if (parsedInputText != 'next') {
      // TODO: add in NLP to parse ReminderTime and convert it to a machine readable format
      userData.DailyReminderTime = parsedInputText;
    else {
      userData.DailyReminderTime = "08:00"; // default reminder time, machine readable format
    }
    userData.NewUser == false;
    storeUserData(userData, (err, data) => {
      // TODO: handle error
      let message = "Great, you're all set! Kato is here to help you easily remember all your daily tasks without having to use some app. We recommend you save this number for future use. Type 'help' to get a list of commands to get started."; // insert tutorial text here
      return callback(null, message);
    });
  }
};

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}
