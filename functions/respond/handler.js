'use strict';

const _ = require('lodash');
const async = require('async');
const Plivo = require('plivo');

const AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});

const config = require('./config.json');
const plivoCreds = require('./plivo-creds.json');

const plivo = Plivo.RestAPI(plivoCreds);

let db = new AWS.DynamoDB.DocumentClient();

module.exports.handler = (event, context, callback) => {

  if (event.To.toString() !== config.PHONE) {
    if (event.From.toString() == config.PHONE) {
      let messageParams = {
        'src': config.PHONE,
        'dst': event.To.toString(),
        'text': "Hello! Welcome to the Woodhouse private beta. We're going to ask a few quick questions to get you setup. What's your name?"
      }
      return sendMessage (messageParams, callback);
    } else {
      console.log(event, config);
      return callback(new Error("Invalid input."));
    }
  } else {
    let inputText = event.Text;
    let userPhone = event.From.toString();
    async.waterfall([
      (next) => {
        let params = {
          phone: userPhone,
          inputText: inputText
        };
        return searchForUserData(params, next);
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
  }
};

const searchForUserData = (params, callback) => {

  db.get({
    "TableName": config.DB_TABLE_NAME,
    "Key": {
      "Phone": params.phone
    }
  }, (err, data) => {
    if (err) {
      console.error("DB GET call unsuccessful. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      if (!data.Item) { // if user doesn't exist in DB
        data.Phone = params.phone;
        data.NewUser = true;
        data.Name = params.inputText;
        data.Todos = {};
        console.log("No DB item found, creating a new item:", JSON.stringify(data, null, 2));
        return initializeUserData(data, callback);
      } else {
        console.log("DB item found:", JSON.stringify(data.Item, null, 2));
        return callback(null, data.Item);
      }
    }
  });

};

// creates a new item in the DB
const initializeUserData = (userData, callback) => {
  db.put({
    "TableName": config.DB_TABLE_NAME,
    "Item": userData
  }, (err, data) => {
    if (err) {
      console.error("Error initializing DB item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("DB item initialized successfully (dynamoDB bug, no data returned, requires calling searchForUserData again):", JSON.stringify(data, null, 2));
      let params = {
        "phone": userData.Phone
      };
      return searchForUserData(params, callback);
    }
  });

};

const updateUserData = (params, message, callback) => {
  db.update(params, (err, data) => {
    if (err) {
      console.error("Error updating DB item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("DB item updated successfully:", JSON.stringify(data, null, 2));
      return callback(null, message);
    }
  });
}

// should be refactored to handle general commands post setup
const handleMessage = (inputText, userData, callback) => {

  console.log(inputText.toString());
  console.log(userData);

  let parsedInputText = inputText.replace(/\+/g, " ").toString();

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
        return callback(null, "Your settings are:\nName: " + userData.Name + "\nTime Zone: " + userData.UserTimeZone + "\nDaily Reminder Time: " + userData.DailyReminderTime + "\nTo make changes to a setting, text the name of the setting and the new value (e.g. Time Zone PT).")
        break;
      default:
        return callback(null, "Woodhouse is still pretty dumb, try typing 'help' to get a list of available options!");
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

  let parsedInputText = inputText.replace(/\+/g, " "); // may not be needed

  let params = {
    "TableName": config.DB_TABLE_NAME,
    "Key": {
      "Phone": userData.Phone
    },
    // UpdateExpression: "set Name=:name",
    // ExpressionAttributeValues: {
    //   ":ame":userData.name,
    // },
    ReturnValues:"UPDATED_NEW"
  };

  if (!userData.UserTimeZone) {
    let tz = parsedInputText.toUpperCase();
    if (tz != 'ET' && tz != 'CT' && tz != 'MT' && tz != 'PT') {
      return callback(null, 'Nice to meet you ' + userData.Name + '! Please reply with one of the four available timezones (ET, CT, MT, or PT).');
    } else {
      params.UpdateExpression = "set UserTimeZone=:tz";
      params.ExpressionAttributeValues = {":tz": tz};
      let message = "Awesome! We send out daily reminders of your top 3 todos (plus more) at 0800. If you'd like to be reminded at a different time, please reply with the new time in military time (if you don't want to change the daily reminder time reply 'next')?";
      updateUserData(params, message, callback);
    }
  } else if (!userData.DailyReminderTime) {
    if (parsedInputText != 'next' && parsedInputText != 'Next') {
      // TODO: add NLP to chnage the time to machine readable format
      params.UpdateExpression = "set DailyReminderTime=:drt, NewUser=:nu";
      params.ExpressionAttributeValues = {":drt": parsedInputText, ":nu": false}; // default reminder time, machine readable format
    } else {
      params.UpdateExpression = "set DailyReminderTime=:drt, NewUser=:nu";
      params.ExpressionAttributeValues = {":drt": "08:00", ":nu": false}; // default reminder time, machine readable format
    }
    let message = "Great, you're all set! Woodhouse is here to help you remember your daily tasks. We recommend you save this number. Type 'help' to get a list of commands to create your first todo!"; // insert tutorial text here
    updateUserData(params, message, callback);
  }
};

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}
