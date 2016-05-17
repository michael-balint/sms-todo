// date_time.js
// =============
// reminderDate object key/value pairs
// StartDate
// StopDate
// RepeatValue
// RepeatFrequency

var chrono = require('chrono-node');
var nlp = require("nlp_compromise");
var moment = require('moment');

// local js libraries
var dynamo = require('./dynamo.js');
var config = require('../config.json');

function processReminder(inputText, userData, callback) {

  var reminderData = [];
  var chronoDateParse;

  chronoDateParse = chrono.parse(inputText);

  if (nlp.text(inputText).sentences.length > 1) { // multiple sentences?
    return callback(null, "Woodhouse is a bit slow still and can't process multiple sentences at this time. Try breaking it up into multiple todos!");

    // } else if (TODO: check for multiple subjects w/ dates) {

  } else { // single subject workflow

    if (chronoDateParse != "") { // date found?

      // check for known qualifiers (BY, EVERY, EVERY OTHER)
      var qualifier = searchForQualifier(inputText, callback);

      if (chronoDateParse.length > 1) { // multiple dates found

        // TODO: need to detect AND or OR (OR is a much rarer case, visit later)
        reminderData = setReminder(chronoDateParse, userData, 'multiple', qualifier, callback);

      } else { // single date

        reminderData = setReminder(chronoDateParse, userData, 'single', qualifier, callback);
      }

    } 
    // remind them everyday (list empty) until deleted
    else { return reminderData; }

  }
  console.log(reminderData);
  return reminderData;

  console.log("===================");
  console.log(chronoDateParse);
  // console.log(chronoDateParse[0].start);
  console.log(chronoDateParse[0].start.knownValues);
  console.log(chronoDateParse[0].start.impliedValues);
  console.log(chronoDateParse[0].start.date());
  if (chronoDateParse[0].end) {
    console.log(chronoDateParse[0].end.date());
  }
}

// TODO: expand this logic to identify the hour of the last muliple date occurence
// and apply it to all items, add additional variable to requestExplicitTimeOfDay
function setReminder(chronoDateParse, userData, dateType, qualifier, callback) {
  var reminderData = [];
  if (dateType == 'multiple') { // multiple days parsed by chrono

    // TODO: take last object's (day's) time range to be applied to the prior days
    var parsedKnownTime = parseChronoKnownTimeValues(chronoDateParse[chronoDateParse.length-1], callback);

    switch(qualifier) {
      case 'repeat': // TODO: still need to figure out how to manage repeat
        console.log('create constant, multiple days/week reminders');
        break;

      default: // likely on or this

        if (parsedKnownTime == undefined) { // no time specified
          requestExplicitTimeOfDay(chronoDateParse, userData, callback);
        }
        else { // START and END time
          reminderData = mergeDateAndTime(chronoDateParse, parsedKnownTime, callback);
          return reminderData;
        }

    }

  } else { // single day parsed by chrono

    // creates reminderData (and optional keys) based on qualifier
    reminderData = setSingleDateReminderData(chronoDateParse, userData, qualifier, callback);
    return reminderData;

  }
}

// texts user for a specific time of day when setting the reminderTime
function requestExplicitTimeOfDay(chronoDateParse, userData, callback) {
  // need to create a placeholder variable to know to pick up here on response
  // Step = time_of_day
  var message = "I noticed you didn't set a time for this todo. What time would you like to be reminded (e.g. 10AM, 5PM, 2 to 3PM)? Or reply 'no' if you don't want to set a specific time.";
  var params = {
    "TableName": config.DB_TABLE_NAME,
    "Key": {
      "Phone": userData.Phone
    },
    UpdateExpression: "set TempData=:tempData, Step=:step",
    ExpressionAttributeValues: {
      ":tempData": chronoDateParse,
      ":step": "request_time_of_day"
    },
    ReturnValues:"UPDATED_NEW"
  };
  console.log(message);
  // dynamo.updateItem(params, message, callback);
  return null;
}

// TODOS in this FUNCTION
// called by handler if UserData.Step = "time_of_day"
// associates a time with a specified day
function saveExplicitTimeOfDay(inputText, UserData, callback) {
  console.log(UserData.TempData);
  console.log(UserData.Step);

  var chronoDateParse = UserData.TempData, message;

  if (inputText == 'no') {
    message = "Thanks! This will be included in your daily reminder only.";

    // figure out a way to return a value that signifies no time of day specified
  } else {

    // TODO: check if times can be determined from Chrono

    message = "Thanks! I'll set the reminder date and time accordingly.";

    // associate a time, handles multiple reminder days
    for (var i = 0; i < chronoDateParse.length; i++) {
      console.log(chronoDateParse[i]);
      // add knownValues time (using inputText)
      // remove ImpliedValues time
      // save to chronoDateParse

      // TODO: add in conditions for multiple days, possibly leverage existing functions
    }

  }

  // update TempData and Step
  var params = {
    "TableName": config.DB_TABLE_NAME,
    "Key": {
      "Phone": userData.Phone
    },
    UpdateExpression: "set TempData=:tempData, Step=:step",
    ExpressionAttributeValues: {
      ":tempData": chronoDateParse,
      ":step": "set_time_of_day"
    },
    ReturnValues:"UPDATED_NEW"
  };
  console.log(message);
  // dynamo.updateItem(params, message, callback);
}

function searchForQualifier(inputText, callback) {
  // if word prior to DATE tag is a PREPOSITION tag and is by, constant reminder
  var terms = nlp.text(inputText).terms();
  console.log(terms);
  for (var i = 0; i < terms.length; i++) { // if PREP is before DATE, take action
    if (terms[i].tag == "Date") {

      switch(terms[i-1].tag) {

        case 'Preposition': // looking for BY
          if (terms[i-1].text == "by") {
            return "persistent";
          } else {
            return null;
          }
          break;

        case 'Determiner': // looking for EVERY (how to handle multiple EVERYS?)
          if (terms[i-1].text == "every") {
            return "repeat";
          } else {
            return null;
          }
          break;

        case("Adjective"): // looking for EVERY OTHER (next iteration)
          if (terms[i-1].text == "other") {
            if (terms[i-2].text == "every") {
              return "alternating";
            }
          } else {
            return null;
          }
          break;
      }
    }
  }
}

// parses out the hour, minute, and second for both the start and end date/times
// as long as they are explicitly defined
function parseChronoKnownTimeValues(chronoDateParse, callback) {
  // chronoDateParse will be chronoDateParse[chronoDateParse.length-1] if multiple objects
  // otherwise will be chronoDateParse[0]

  var startDate = chronoDateParse.start.knownValues;
  if (chronoDateParse.end) {
    var endDate = chronoDateParse.end.knownValues;
  }
  var parsedKnownTime = [];

  if (chronoDateParse.start) {
    // TODO: should add in logic to test if startDate values exist vs assigning them as undefined
    // impacts the multiple value logic
    if (startDate.hasOwnProperty("hour")) {
      return parsedKnownTime;
    } else {
      parsedKnownTime[0] = {
        "hour": startDate["hour"],
        "minute": startDate["minute"],
        "second": startDate["second"]
      };
    }
    if (chronoDateParse.end) {
      parsedKnownTime[1] = {
        "hour": endDate["hour"],
        "minute": endDate["minute"],
        "second": endDate["second"]
      };
      return parsedKnownTime;
    }
  }
}

// merges the date with times (for multiple days specified)
function mergeDateAndTime(chronoDateParse, parsedKnownTime, callback){
  // chronoDateParse[i] >> counts through the various identified ParsedResults
  // parsedKnownTime[0] (START time), parsedKnownTime[1] (STOP time)

  var reminderTime = [];
  var startDate = [];
  var endDate = [];

  // find all the variables for start and stop

  // add start and stop date variables for each chronoDateParse object
  for (var i = 0; i < chronoDateParse.length; i++) { // iterate through # of date objects

    startDate[i] = setDateAndTimeValues(chronoDateParse[i].start, parsedKnownTime[0], callback);

    if (parsedKnownTime[1]) { // did the user define an end time
      if (chronoDateParse[i].end) { // does this object # contain an existing END object
        endDate[i] = setDateAndTimeValues(chronoDateParse[i].end, parsedKnownTime[1], callback);
      } else {
        endDate[i] = setDateAndTimeValues(chronoDateParse[i].start, parsedKnownTime[1], callback);
      }
    }

    reminderTime[i] = {
      "StartDate": moment([ 
          startDate[i]["year"],
          startDate[i]["month"]-1, // bug-ish
          startDate[i]["day"],
          startDate[i]["hour"],
          startDate[i]["minute"],
          startDate[i]["second"]
      ])._d
    };

    // checks if an EndDate needs to be saved
    if (parsedKnownTime[1]) {
      reminderTime[i]["EndDate"] = moment([ 
        endDate[i]["year"],
        endDate[i]["month"]-1, // bug-ish
        endDate[i]["day"],
        endDate[i]["hour"],
        endDate[i]["minute"],
        endDate[i]["second"]
      ])._d;
    }
  }

  return reminderTime;
}

function setDateAndTimeValues(chronoDateParse, parsedKnownTime, callback) {

  var knownValues = chronoDateParse.knownValues;
  var impliedValues = chronoDateParse.impliedValues;

  var dateAndTime = {};

  // knownValues
  if (knownValues["year"] != null) {
    dateAndTime["year"] = knownValues["year"];
  }
  if (knownValues["month"] != null){
    dateAndTime["month"] = knownValues["month"];
  }
  if (knownValues["day"] != null){
    dateAndTime["day"] = knownValues["day"];
  }
  if (knownValues["hour"] != null){
    dateAndTime["hour"] = knownValues["hour"];
  }
  if (knownValues["minute"] != null){
    dateAndTime["minute"] = knownValues["minute"];
  }
  if (knownValues["second"] != null){
    dateAndTime["second"] = knownValues["second"];
  }

  // impliedValues
  if (impliedValues["year"] != null) {
    dateAndTime["year"] = impliedValues["year"];
  }
  if (impliedValues["month"] != null){
    dateAndTime["month"] = impliedValues["month"];
  }
  if (impliedValues["day"] != null){
    dateAndTime["day"] = impliedValues["day"];
  }
  if (impliedValues["hour"] != null){
    dateAndTime["hour"] = impliedValues["hour"];
  }
  if (impliedValues["minute"] != null){
    dateAndTime["minute"] = impliedValues["minute"];
  }
  if (impliedValues["second"] != null){
    dateAndTime["second"] = impliedValues["second"];
  }

  // parsedKnownTime
  if (parsedKnownTime["hour"] != null){
    dateAndTime["hour"] = parsedKnownTime["hour"];
  }
  if (parsedKnownTime["minute"] != null){
    dateAndTime["minute"] = parsedKnownTime["minute"];
  }
  if (parsedKnownTime["second"] != null){
    dateAndTime["second"] = parsedKnownTime["second"];
  }

  return dateAndTime;
}

function setSingleDateReminderData(chronoDateParse, userData, qualifier, callback) {

  var reminderData = [];

  if (chronoDateParse[0].end) { // has a time range

    reminderData = {
      "StartDate": chronoDateParse[0].start.date(), 
      "StopDate": chronoDateParse[0].end.date()
    };
    switch(qualifier) {
      case 'persistent':
        reminderData["Persistent"] = true;
      case 'repeat':
        reminderData["Repeat"] = "weekly";
      case 'alternating':
        reminderData["Repeat"] = "bi-weekly";
    }
    return reminderData;

  } else { // no time range specified

    if (chronoDateParse[0].start.impliedValues.hasOwnProperty("hour")) { // no time specified
      requestExplicitTimeOfDay(chronoDateParse, userData, callback);

    } else { // time specified

      reminderData = { "StartDate": chronoDateParse[0].start.date() };
      switch(qualifier) {
        case 'persistent':
          reminderData["Persistent"] = true;
        case 'repeat':
          reminderData["Repeat"] = "weekly";
        case 'alternating':
          reminderData["Repeat"] = "bi-weekly";
      }
      return reminderData;
    }
  }
}

module.exports = {
  processReminder: processReminder,
  saveExplicitTimeOfDay: saveExplicitTimeOfDay
}