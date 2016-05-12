// setup.js
// =============

var async = require('async');

// local js libraries
var dynamo = require('./dynamo.js');
var alchemy = require('./alchemy.js');
var config = require('../config.json');

// TODO: add in various conditions
// 1) new task (Remind me)
// 2) list tasks (List)
// 3) edit task (Edit N)
// 4) remove task (Delete N) >> note removes it but never deletes

function createTodo(inputText, userData, callback) {

  // TODO: check if this todo exists?

  // TODO: add NLP to parse out the todo text
  // save it to the DB (subject, qty, date, time, importance)
  // may have to ask the user for additional information if not provided
  // will require a nested check to remember the Reminder task
  // reference it to the cron job

  // remove 'Remind' as it messes up the NLP
  var nlpText = { text: inputText.replace(/remind /gi, "").toString() };

  // initialize an empty params to pass to DB
  var params = {};

  // params.UpdateExpression = "set Todos.Taxonomy=:tax, Todos.TaxonomyScore=:tax_score, Todos.Keyword=:keyword, Todos.KeywordRelevance=:keyword_relevance, Todos.RelationsSentence=:relations_sentence, Todos.RelationsSubject=:relations_subject, Todos.RelationsAction=:relations_action, Todos.RelationsObject=:relations_object";
  async.waterfall([
    (next) => {
      return alchemy.alchemyRelations(nlpText, params, next);
    },
    (params, next) => {
      return alchemy.alchemyKeywords(nlpText, params, next);
    },
    (params, next) => {
      return alchemy.alchemyTaxonomy(nlpText, params, next);
    },
    (params, next) => {
      params["Date"] = new Date();
      console.log(params);
      // TODO: needs to be updated
      // return dynamo.createItem(params, 'todos', callback);
    }
  ], (err) => {
    return callback(err, response);
  });
}

// handle all input conditions from user
function listTodo(inputText, userData, callback) {

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
    text: inputText.replace(/list /gi, "").toString()
  };

  // TODO: list all tasks (start with top 3) and then provide 'more' option to list more tasks
  // Query and Scan the Data http://docs.aws.amazon.com/amazondynamodb/latest/gettingstartedguide/GettingStarted.NodeJs.04.html
}

// handle all input conditions from user
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

function removeTodo(inputText, userData, callback) {

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
    text: inputText.replace(/delete /gi, "").toString()
  };

  var todoNumber = Number(inputText.replace(/delete /gi, ""));
  // TODO: get list of all todoNumbers associated with user
  if (todoNumber === parseInt(data, 10)) {
    // delete todo
  }
}

function updateSettings(inputText, userData, callback) {

  var params = {
    "TableName": config.DB_TABLE_USERS,
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
function processMessage(inputText, userData, callback) {

  // GENERAL COMMANDS
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
      return callback(null, "Woodhouse is still pretty dumb, try typing 'help' to get a list of available options!");
  }
}

function initialSetup(inputText, userData, callback) {

  var params = {
    "TableName": config.DB_TABLE_USERS,
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
  editTodo: editTodo,
  removeTodo: removeTodo,
  updateSettings: updateSettings,
  processMessage: processMessage,
  initialSetup: initialSetup
};