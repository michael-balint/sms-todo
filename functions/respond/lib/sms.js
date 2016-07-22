// sms.js
// =============

const _ = require('lodash');
const async = require('async');
var moment = require('moment');

// local js libraries
var plivo = require('./plivo.js');
var dynamo = require('./dynamo.js');
var reminder = require('./reminder.js');
var config = require('../config.json');

// TODO: add in various conditions
// 1) new task (Remind me)
// 2) list tasks (List)
// 3) edit task (Edit N)
// 4) remove task (Delete N) >> note removes it but never deletes

function handleMessage(params, callback) {
  if (params.To.toString() !== config.PHONE) { // validates SMS parameters

    if (params.From.toString() == config.PHONE) { // initiates new user onboarding

      let messageParams = {
        'src': config.PHONE,
        'dst': params.To.toString(),
        'text': "Hello! My name is Woodhouse, welcome to my private beta. I'm here to help manage all your todos. To get started, I'm going to ask a few quick questions. What's your name?"
      }

      return plivo.sendMessage (messageParams, callback);

    } else {

      console.log(params, config);
      return callback(new Error("Invalid input."));
    }
  } else {

    let inputText = params.Text;
    let userPhone = params.From.toString();

    async.waterfall([
      (next) => { // locate the user or create a new one

        let params = {
          Phone: userPhone,
          inputText: inputText
        };

        return dynamo.searchForItem(params, next);

      },
      (userData, next) => { // run through initialSetup or handleMessage

        if (userData.NewUser == true) { return initialSetup(inputText, userData, next); }

        // else if (userData.Step) { // multi-step sms conditions

        //   switch(userData.Step) {

        //     case 'request_time_of_day':
        //       reminder.saveExplicitTimeOfDay(inputText, userData, next);
        //       break;

        //     case 'set_time_of_day':
        //       // reminder.set
        //       break;
        //   }
        // }

        else {

          // CREATE todo
          if (inputText.search(/remind me to /gi) >= 0) { return createTodo(inputText, userData, next); }

          // LIST todo
          else if (inputText.search(/list/gi) >= 0) { return listTodo(inputText, userData, next); }

          // EDIT todo
          else if (inputText.search(/edit /gi) >= 0) { return editTodo(inputText, userData, next); }

          // DELETE todo
          else if (inputText.search(/delete /gi) >= 0) { return deleteTodo(inputText, userData, next); }

          // UPDATE settings
          else if (inputText.search(/name /gi) >= 0 ||
                      inputText.search(/time zone /gi) >= 0 ||
                      inputText.search(/daily reminder time /gi) >= 0) { return updateSettings(inputText, userData, next); }

          // INITIAL SETUP and other use cases
          else { return processMessage(inputText, userData, next); }

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
}

function createTodo(inputText, userData, callback) {

  // TODO: check if this todo exists?

  return reminder.processReminder(inputText, userData, callback);
}

function listTodo(inputText, userData, callback) {

  // TODO: list all tasks (start with top 3) and then provide 'more' option to list more tasks

  var todos = userData.Todos;
  var message = "Your todos are: ";
  for (var i = 0; i < todos.length; i++) {
    message = message + (i + 1) + ") " + todos[i].Input.replace(/remind me to /gi, "") + " ";
  }

  return callback(null, message);
}

// TODO: need to decide what to do with this
function editTodo(inputText, userData, callback) {

  var params = {
    "TableName": config.DB_TABLE_TODOS,
    "Key": {
      "Phone": userData.Phone
      // add in date
    },
    // UpdateExpression: "set UserName=:name",
    ExpressionAttributeValues: {},
    ReturnValues:"UPDATED_NEW"
  };


  // TODO: add NLP to parse out the todo text
  // save it to the DB (subject, qty, date, time, importance)
  // may have to ask the user for additional information if not provided
  // will require a nested check to remember the Reminder task
  // reference it to the cron job

  var nlpText = {
    text: inputText.replace(/edit /gi, "").toString()
  };

  var todoNumber = Number(inputText.replace(/edit /gi, ""));
  // TODO: get list of all todoNumbers associated with user
  if (todoNumber === parseInt(data, 10)) { // add && condition to check if the todoNumber exists
    // TODO: provide an option to change the various settings (subject, qty, date/time, importance)
    // requires a nested check to remember the Edit task
  } else {
    return callback(null, "Oops! Looks like this todo either doesn't exist or you didn't enter a number. Try again and enter 'Edit N' (where N is an existing todo number).")
  }
}

function deleteTodo(inputText, userData, callback) {

  // TODO: add NLP to parse out the todo text
  // save it to the DB (subject, qty, date, time, importance)
  // may have to ask the user for additional information if not provided
  // will require a nested check to remember the Reminder task
  // reference it to the cron job

  var todos = userData.Todos;
  var todosCount = todos.length;

  var nlpText = {
    text: inputText.replace(/delete /gi, "").toString()
  };

  var todoNumber = Number(inputText.replace(/delete /gi, ""));
  // TODO: get list of all todoNumbers associated with user
  if (todoNumber === parseInt(todoNumber, 10) &&
        todoNumber <= todosCount &&
        todoNumber > 0) {

    todoNumber = todoNumber - 1;

    // setup TABLE update params
    var params = {
      TableName: config.DB_TABLE_NAME,
      Key:{
        "Phone": userData.Phone
      },
      UpdateExpression: "REMOVE Todos[" + todoNumber + "]",
      ReturnValues:"UPDATED_NEW"
    };

    return dynamo.deleteElement(params, callback);

  } else {
    return callback(null, "Invalid todo number.");
  }
}

function updateSettings(inputText, userData, callback) {

  var params = {
    "TableName": config.DB_TABLE_NAME,
    "Key": {
      "Phone": userData.Phone
    },
    // UpdateExpression: "set UserName=:name",
    // ExpressionAttributeValues: {},
    ReturnValues:"UPDATED_NEW"
  };

  if (inputText.search(/name /gi) >= 0) { // update NAME

    var name = toTitleCase(inputText.replace(/name /gi, ""));
    var message = "Your name has been updated.";

    params.UpdateExpression = "set UserName=:name";
    params.ExpressionAttributeValues = {":name": name};

    dynamo.updateItem(params, message, callback);

  } else if (inputText.search(/time zone /gi) >= 0) { // update TIME ZONE

    var tz = inputText.replace(/time zone /gi, "").toUpperCase();

    if (tz != 'ET' && tz != 'CT' && tz != 'MT' && tz != 'PT') {
      return callback(null, "Oops, that's not an option. Text one of the four available timezones (ET, CT, MT, or PT) and try again.");
    } else {
      var message = "Your time zone has been updated.";

      params.UpdateExpression = "set UserTimeZone=:tz";
      params.ExpressionAttributeValues = {":tz": tz};

      dynamo.updateItem(params, message, callback);
    }

  } else if (inputText.search(/daily reminder time /gi) >= 0) { // update DAILY REMINDER TIME

    var drt = inputText.replace(/daily reminder time /gi, "");
    var message = "Your daily reminder time has been updated.";

    params.UpdateExpression = "set DailyReminderTime=:drt";

    if (drt == "disable") {
      params.ExpressionAttributeValues = {":drt": false};
    } else {
      if (validateTime(drt)) {
        params.ExpressionAttributeValues = {":drt": drt};
      } else {
        return callback(null, "Oops, that's not a valid time format. Text the time in military format (e.g. Daily Reminder Time 09:30).");
      }
    }

    dynamo.updateItem(params, message, callback);
  }
}

// handle all other input conditions from user
function processMessage(inputText, userData, callback) {  // GENERAL COMMANDS
  switch(inputText) {

    case 'help':
      return callback(null, "1) create a todo, start a text with 'Remind me to' 2) retrieve the list of all your todos, text 'list' 3) edit a todo, text 'Edit N' (where N is the todo number) 4) delete a todo, text 'Delete N' (where N is the todo number) 5) view your settings type 'settings'");
      break;

    case 'settings':
      var drt = userData.DailyReminderTime;
      if (drt == false) { drt = "Disabled"; }
      return callback(null, "Your settings are: 1) Name: " + userData.UserName + " 2) Time Zone: " + userData.UserTimeZone + " 3) Daily Reminder Time: " + drt + ". To make changes to a setting, text the name of the setting and the new value (e.g. Time Zone PT or Daily Reminder Time 0900).")
      break;

    default:
      return callback(null, "Woodhouse is still pretty dumb. Try typing 'help' to get a list of available options!");
  }
}

function initialSetup(inputText, userData, callback) {

  var params = {
    "TableName": config.DB_TABLE_NAME,
    "Key": {
      "Phone": userData.Phone
    },
    // UpdateExpression: "set UserName=:name",
    // ExpressionAttributeValues: {},
    ReturnValues:"UPDATED_NEW"
  };

  if (!userData.UserTimeZone) {

    var tz = inputText.toUpperCase();

    if (tz != 'ET' && tz != 'CT' && tz != 'MT' && tz != 'PT') {
      return callback(null, 'Nice to meet you ' + userData.UserName + '! What timezone do you reside in (ET, CT, MT, or PT)?');
    } else {
      params.UpdateExpression = "set UserTimeZone=:tz";
      params.ExpressionAttributeValues = {":tz": tz};
      var message = "Fantastic! By default, I send a daily reminder of all your todos at 08:00. If you'd like me to remind you at a different time, please reply in military time (to keep the default, reply 'next' or to turn off the daily remember, reply 'disable')?";
      dynamo.updateItem(params, message, callback);
    }

  } else if (!userData.DailyReminderTime) {

    var drt = inputText.toLowerCase();
    var message = "Perfect, you're all set! I'm here to help you remember your daily todos. First things first, save my number! To get started, type 'help' to get a list of commands!";

    params.UpdateExpression = "set DailyReminderTime=:drt, NewUser=:nu";

    if (drt != 'next' && drt != 'disable') {

      if (validateTime(drt)) {
        params.ExpressionAttributeValues = {":drt": drt, ":nu": false};
      } else {
        return callback(null, "Oops, that's not a valid time format. Text the time in military format (e.g. Daily Reminder Time 09:30).");
      }

    } else if (drt == 'disable') {
      params.ExpressionAttributeValues = {":drt": false, ":nu": false};
    } else { // default reminder time
      params.ExpressionAttributeValues = {":drt": "08:00", ":nu": false};
    }

    dynamo.updateItem(params, message, callback);
  }
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function validateTime(time) {
  var re = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
  return re.test(time);
}

module.exports = {
  handleMessage: handleMessage,
  createTodo: createTodo,
  listTodo: listTodo,
  // editTodo: editTodo,
  deleteTodo: deleteTodo,
  updateSettings: updateSettings,
  processMessage: processMessage,
  initialSetup: initialSetup
};
