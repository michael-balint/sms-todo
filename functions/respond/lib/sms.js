// setup.js
// =============

var moment = require('moment');

// local js libraries
var dynamo = require('./dynamo.js');
var alchemy = require('./alchemy.js');
var reminder = require('./reminder.js');
var config = require('../config.json');

// TODO: add in various conditions
// 1) new task (Remind me)
// 2) list tasks (List)
// 3) edit task (Edit N)
// 4) remove task (Delete N) >> note removes it but never deletes

function createTodo(inputText, userData, callback) {

  // TODO: check if this todo exists?

  var timestamp = moment().unix();

  var reminderData = reminder.processReminder(inputText, userData, callback);
  reminderData["DateCreated"] = timestamp;
  reminderData["Input"] = inputText;

  console.log(reminderData);

  if (reminderData == '') { // no reminder date or time specified/detected
    var message = "Thanks! You'll be reminded each day until deleted.";
  } else {
    // TODO: add in randomized responses
    var message = "Roger, todo saved."; // repeat it back to them (to verify)
  }

  // set Todo params
  var createTodoParams = {
    TableName: config.DB_TABLE_NAME,
    Key:{
      "Phone": userData.Phone
    },
    UpdateExpression: "SET Todos = list_append(Todos, :todo)",
    ExpressionAttributeValues: {
      ":todo": [reminderData]
    },
    ReturnValues:"UPDATED_NEW"
  };

  reminderData["Phone"] = userData.Phone;
  dynamo.createItem(reminderData, 'archive', null);

  return dynamo.updateItem(createTodoParams, message, callback);
  
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
  createTodo: createTodo,
  listTodo: listTodo,
  // editTodo: editTodo,
  deleteTodo: deleteTodo,
  updateSettings: updateSettings,
  processMessage: processMessage,
  initialSetup: initialSetup
};