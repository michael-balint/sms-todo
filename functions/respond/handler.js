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

  // let messageParams = {
  //   'src': event.To,
  //   'dst': event.From,
  //   'text': "lolcat"
  // };
  // return sendMessage(messageParams, callback);

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
      return getOrCreateUserData(userParams, next);
    },
    (UserData, next) => {
      if (UserData.NewUser == true) {
        return initialSetup(inputText, UserData, next);
      } else {
        return handleMessage(inputText, UserData, next);
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

const getOrCreateUserData = (params, callback) => {

  db.get({
    "TableName": config.DB_TABLE_NAME,
    "Key": {
      "Phone": params.phone
    }
  }, (err, data) => {
    if (err) { 
      return callback(err); 
    } else {
      if (!data.Phone) { // if user doesn't exist in DB
        data.Phone = params.phone;
        data.NewUser = true;
        data.Todos = {};
        storeUserData(data, callback);
      }
    }

    return callback(null, data);
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

  if (parsedInputText.search(/Remind me /gi) >= 0) { // condition for lowercase 'remind'
    parsedInputText.replace(/Remind me /gi, "");
    // TODO: add NLP to parse out the todo text
    // save it to the DB (subject, qty, date/time, importance)
    // may have to ask the user for additional information if not provided
    // will require a nested check to remember the Reminder task
    // reference it to the cron job
  } else if (parsedInputText.search(/Edit /gi) >= 0) { // condition for lowercase 'edit'
    let todoNumber = Number(parsedInputText.replace(/Edit /gi, ""));
    // TODO: get list of all todoNumbers associated with user
    if (todoNumber === parseInt(data, 10)) { // add && condition to check if the todoNumber exists
      // TODO: provide an option to change the various settings (subject, qty, date/time, importance)
      // requires a nested check to remember the Edit task
    } else {
      return callback(null, "Oops! Looks like this todo either doesn't exist or you didn't enter a number. Try again and enter 'Edit N' (where N is an existing todo number).")
    }
  } else if (parsedInputText.search(/Name /gi) >= 0) { // condition for lowercase 'name', does this conflict with 'setting' command
    userData.Name = toTitleCase(parsedInputText.replace(/Name /gi, ""));
    storeUserData(userData, (err, data) => {
      // TODO: handle error
      return callback(null, "Great! Your name has been updated.");
    });
  } else if (parsedInputText.search(/Time Zone /gi) >= 0) { // condition for lowercase 'time zone', does this conflict with 'setting' command
    userData.TimeZone = parsedInputText.replace(/Time Zone /gi, "").toUpperCase();
    if (userData.TimeZone != 'ET' || userData.TimeZone != 'CT' || userData.TimeZone != 'MT' || userData.TimeZone != 'PT') {
      return callback(null, 'Please use one of the four available timezones (ET, CT, MT, or PT) and try again.');
    } else {
      storeUserData(userData, (err, data) => {
        // TODO: handle error
        return callback(null, "Amazing! Your time zone has been updated.");
      });
    }
  } else if (parsedInputText.search(/Daily Reminder Time /gi) >= 0) { // condition for lowercase 'daily reminder time', does this conflict with 'setting' command
    UserData.DailyReminderTime = parsedInputText.replace(/Daily Reminder Time /gi, "");
    // TODO: use NLP to parse out the setting and new value, throw exception if unable to parse into machine readable time
    storeUserData(userData, (err, data) => {
      // TODO: handle error
      return callback(null, "Fabulous! Your daily reminder time has been updated.");
    });
  } else {
    switch(parsedInputText.toLowerCase()) {
      case 'help':
        return callback(null, "1) To create a new todo, start a text message with 'Remind me'\n2) To get the list of all your todos, text 'list'\n3) To edit a todo, text 'Edit N' (where N is an existing todo number)\n4) to view your settings type 'settings'");
        break;
      case 'list':
        // TODO: list all tasks (start with top 3) and then provide 'more' option to list more tasks
        break;
      case 'settings':
        return callback(null, "Your settings are:\nName: ${userData.Name}\nTime Zone: ${userData.TimeZone}\nDaily Reminder Time: ${userData.DailyReminderTime}\nTo make changes to a setting, text the name of the setting and the new value (e.g. Time Zone PT).")
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

// initial setup for new user
const initialSetup = (inputText, userData, callback) => {

  let parsedInputText = inputText.replace(/\+/g, " ");

  if (!userData.Name) {
    userData.Name = toTitleCase(parsedInputText);
    storeUserData(userData, (err, data) => {
      // TODO: handle error
      return callback(null, `Hello ${userData.Name}! What timezone are you in (ET, CT, MT, or PT)?`);
    });
  } else if (!userData.TimeZone) {
    userData.TimeZone = parsedInputText.toUpperCase();
    if (userData.TimeZone != 'ET' || userData.TimeZone != 'CT' || userData.TimeZone != 'MT' || userData.TimeZone != 'PT') {
      return callback(null, 'Please reply with one of the four available timezones (ET, CT, MT, or PT).');
    } else {
      storeUserData(userData, (err, data) => {
        // TODO: handle error
        return callback(null, "Awesome! We send out daily reminders of your top 3 todos (plus more) at 8AM. If you'd like to be reminded at a different time, please reply with the new time (if you don't want to change the daily reminder time reply 'next')?");
      });
    }
  } else if (!userData.DailyReminderTime) {
    if (parsedInputText != 'next') {
      // TODO: add in NLP to parse ReminderTime and convert it to a machine readable format
      // throw error if not an acceptable response
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
