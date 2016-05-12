'use strict';

// npm modules
const _ = require('lodash');
const async = require('async');
const moment = require('moment');

// local js libraries
const userTable = require('./lib/user-table.js');
const alchemy = require('./lib/alchemy.js');
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
          return initialSetup(inputText, userData, next);
        } else {
          return handleMessage(inputText, userData, next);
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



// handle all input conditions from user
const handleMessage = (inputText, userData, callback) => {

  let parsedInputText = inputText.replace(/\+/g, " ").toString().toLowerCase();

  let params = {
    "TableName": config.DB_TABLE_USERS,
    "Key": {
      "Phone": userData.Phone
    },
    // UpdateExpression: "set UserName=:name",
    ExpressionAttributeValues: {},
    ReturnValues:"UPDATED_NEW"
  };

  // TODO: add in various conditions
  // 1) new task (Remind me)
  // 2) list tasks (list)
  // 3) edit task (Edit N)
  // 4) delete task (Delete N)

  // todo commands
  if (parsedInputText.search(/remind me to /gi) >= 0) {

    // parsedInputText.replace(/remind me/gi, "");
    // TODO: add NLP to parse out the todo text
    // save it to the DB (subject, qty, date, time, importance)
    // may have to ask the user for additional information if not provided
    // will require a nested check to remember the Reminder task
    // reference it to the cron job

    let nlpText = {
      text: inputText.replace(/remind /gi, "").toString()
    };

    // had to create a new DB table
    // reference PHONE and DATE
    // 
    params.UpdateExpression = "set Todos.Taxonomy=:tax, Todos.TaxonomyScore=:tax_score, Todos.Keyword=:keyword, Todos.KeywordRelevance=:keyword_relevance, Todos.RelationsSentence=:relations_sentence, Todos.RelationsSubject=:relations_subject, Todos.RelationsAction=:relations_action, Todos.RelationsObject=:relations_object";
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
        let message = "Got it. Task saved.";
        console.log(params);
        return userTable.updateUserData(params, message, callback);
      }
    ], (err) => {
      return callback(err, response);
    });

  } else if (parsedInputText == 'list') {
    // TODO: list all tasks (start with top 3) and then provide 'more' option to list more tasks
    // Query and Scan the Data http://docs.aws.amazon.com/amazondynamodb/latest/gettingstartedguide/GettingStarted.NodeJs.04.html
  } else if (parsedInputText.search(/edit /gi) >= 0) {
    let todoNumber = Number(parsedInputText.replace(/edit /gi, ""));
    // TODO: get list of all todoNumbers associated with user
    if (todoNumber === parseInt(data, 10)) { // add && condition to check if the todoNumber exists
      // TODO: provide an option to change the various settings (subject, qty, date/time, importance)
      // requires a nested check to remember the Edit task
    } else {
      return callback(null, "Oops! Looks like this todo either doesn't exist or you didn't enter a number. Try again and enter 'Edit N' (where N is an existing todo number).")
    }
  } else if (parsedInputText.search(/delete /gi) >= 0) {
    let todoNumber = Number(parsedInputText.replace(/delete /gi, ""));
    // TODO: get list of all todoNumbers associated with user
    if (todoNumber === parseInt(data, 10)) {
      // delete todo
    }
  } else if (parsedInputText.search(/name /gi) >= 0) { // update settings
    let name = toTitleCase(parsedInputText.replace(/name /gi, ""));
    params.UpdateExpression = "set UserName=:name";
    params.ExpressionAttributeValues = {":name": name};
    let message = "Your name has been updated.";
    userTable.updateUserData(params, message, callback);
  } else if (parsedInputText.search(/time zone /gi) >= 0) {
    let tz = parsedInputText.replace(/time zone /gi, "").toUpperCase();
    if (tz != 'ET' && tz != 'CT' && tz != 'MT' && tz != 'PT') {
      return callback(null, "Oops, that's not an option. Text one of the four available timezones (ET, CT, MT, or PT) and try again.");
    } else {
      params.UpdateExpression = "set UserTimeZone=:tz";
      params.ExpressionAttributeValues = {":tz": tz};
      let message = "Your time zone has been updated.";
      userTable.updateUserData(params, message, callback);
    }
  } else if (parsedInputText.search(/daily reminder time /gi) >= 0) {
    let drt = parsedInputText.replace(/daily reminder time /gi, "");
    let message = "Your daily reminder time has been updated.";
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
    userTable.updateUserData(params, message, callback);
  } else {
    // general commands
    switch(parsedInputText) {
      case 'help':
        return callback(null, "1) create a todo, start a text with 'Remind me to' 2) retrieve the list of all your todos, text 'list' 3) edit a todo, text 'Edit N' (where N is the todo number) 4) delete a todo, text 'Delete N' (where N is the todo number) 5) view your settings type 'settings'");
        break;
      case 'settings':
        let drt = userData.DailyReminderTime;
        if (drt == false) { drt = "Disabled"; }
        return callback(null, "Your settings are: 1) Name: " + userData.UserName + " 2) Time Zone: " + userData.UserTimeZone + " 3) Daily Reminder Time: " + drt + ". To make changes to a setting, text the name of the setting and the new value (e.g. Time Zone PT or Daily Reminder Time 0900).")
        break;
      default:
        return callback(null, "Woodhouse is still pretty dumb, try typing 'help' to get a list of available options!");
    }
  }
};

// initial setup for new user
const initialSetup = (inputText, userData, callback) => {

  let parsedInputText = inputText.replace(/\+/g, " "); // may not be needed

  let params = {
    "TableName": config.DB_TABLE_USERS,
    "Key": {
      "Phone": userData.Phone
    },
    // UpdateExpression: "set UserName=:name",
    // ExpressionAttributeValues: {
    //   ":name":userData.name,
    // },
    ReturnValues:"UPDATED_NEW"
  };

  if (!userData.UserTimeZone) {
    let tz = parsedInputText.toUpperCase();
    if (tz != 'ET' && tz != 'CT' && tz != 'MT' && tz != 'PT') {
      return callback(null, 'Nice to meet you ' + userData.UserName + '! What timezone do you reside in (ET, CT, MT, or PT)?');
    } else {
      params.UpdateExpression = "set UserTimeZone=:tz";
      params.ExpressionAttributeValues = {":tz": tz};
      let message = "Fantastic! By default, I send a daily reminder of all your todos at 08:00. If you'd like me to remind you at a different time, please reply in military time (to keep the default, reply 'next' or to turn off the daily remember, reply 'disable')?";
      userTable.updateUserData(params, message, callback);
    }
  } else if (!userData.DailyReminderTime) {
    let drt = parsedInputText.toLowerCase();
    let message = "Perfect, you're all set! I'm here to help you remember your daily todos. First things first, save my number! To get started, type 'help' to get a list of commands!";
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
    userTable.updateUserData(params, message, callback);
  }
};

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function validateTime(time) {
  var re = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
  return re.test(time);
}
