// date_time.js
// =============
// reminderDate object key/value pairs
// StartDate = UNIX time
// EndDate = UNIX time
// Repeat = string
// Persistent = boolean

// npm modules
var _ = require('lodash');
var chrono = require('chrono-node');
var nlp = require("nlp_compromise");
var moment = require('moment');

// local js libraries
var dynamo = require('./dynamo.js');
var config = require('../config.json');

function processReminder(inputText, userData, callback) {

  var chronoDateParse;

  chronoDateParse = chrono.parse(inputText, moment()._d, {forwardDatesOnly: true});
  console.log(chronoDateParse);

  if (nlp.text(inputText).sentences.length > 1) { // multiple sentences?
    return callback(null, "Woodhouse is a bit slow still and can't process multiple sentences at this time. Try breaking it up into multiple todos!");

    // } else if (TODO: check for multiple NOUNS) {
      // TODO: add in a check for multiple NOUNS and return stupid
      // have to remove 'remind me' first since me returns as a NOUN

  } else { // single subject workflow

    if (chronoDateParse != "") { // date found?

      // check for known qualifiers (BY, EVERY, EVERY OTHER)
      var qualifier = searchForQualifier(inputText, callback);

      if (chronoDateParse.length > 1) { // multiple dates found

        // TODO: need to detect AND or OR between DATES (OR is a much rarer case, visit later)
        return setReminder(chronoDateParse, userData, 'multiple', qualifier, inputText, callback);

      } else { // single date

        return setReminder(chronoDateParse, userData, 'single', qualifier, inputText, callback);
      }

    }
    else { // remind them everyday (list empty) until deleted

      return saveReminderDataToDB({}, userData, inputText, callback);
    }

  }

  // FOR TESTING
  // console.log("===================");
  // console.log(chronoDateParse);
  // // console.log(chronoDateParse[0].start);
  // console.log(chronoDateParse[0].start.knownValues);
  // console.log(chronoDateParse[0].start.impliedValues);
  // console.log(chronoDateParse[0].start.date());
  // if (chronoDateParse[0].end) {
  //   console.log(chronoDateParse[0].end.date());
  // }
}

// finds the prior word to identify time qualifier
// NOTE doesn't handle multiple subject / date combos
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
          } else if (terms[i-1].text == "until") {
            return "repeat";
          } else {
            return null;
          }

        case 'Determiner': // looking for EVERY (how to handle multiple EVERYS?)
          if (terms[i-1].text == "every") {
            return "repeat";
          } else {
            return null;
          }

        case 'Adjective': // looking for EVERY OTHER (next iteration)
          if (terms[i-1].text == "other") {
            if (terms[i-2].text == "every") {
              return "alternating";
            }
          } else {
            return null;
          }
      }
    }
  }
}

// TODO: expand this logic to identify the hour of the last muliple date occurence
// and apply it to all items, add additional variable to requestExplicitTimeOfDay
function setReminder(chronoDateParse, userData, dateType, qualifier, inputText, callback) {
  var reminderData = [];
  if (dateType == 'multiple') { // multiple days parsed by chrono

    return setMultipleDateReminderData(chronoDateParse, userData, qualifier, inputText, callback);

    // // TODO: take last object's (day's) time range to be applied to the prior days
    // var parsedKnownTime = parseChronoKnownTimeValues(chronoDateParse[chronoDateParse.length-1], callback);

    // switch(qualifier) {
    //   case 'repeat': // TODO: still need to figure out how to manage repeat
    //     console.log('create constant, multiple days/week reminders');
    //     break;

    //   default: // likely on or this

    //     if (parsedKnownTime == undefined) { // no time specified
    //       return requestExplicitTimeOfDay(chronoDateParse, userData, callback);
    //     }
    //     else { // START and END time
    //       return mergeDateAndTime(chronoDateParse, parsedKnownTime, callback);
    //     }

    // }

  } else { // single day parsed by chrono

    // creates reminderData (and optional keys) based on qualifier
    return setSingleDateReminderData(chronoDateParse, userData, qualifier, inputText, callback);
  }
}

function setSingleDateReminderData(chronoDateParse, userData, qualifier, inputText, callback) {

  var reminderData = [];

  if (chronoDateParse[0].end) { // has a time range

    reminderData = {
      "StartDate": chronoDateParse[0].start.date(), 
      "EndDate": chronoDateParse[0].end.date()
    };

    // convert to UNIX
    reminderData["EndDate"] = moment.unix(reminderData["EndDate"])._i;
    reminderData["StartDate"] = moment.unix(reminderData["StartDate"])._i;

    // identify and add qualifier to reminderData
    reminderData = addQualifierToReminderData(reminderData, qualifier, callback);

    return saveReminderDataToDB(reminderData, userData, inputText, callback); // save to DB

  } else { // no time range specified

    if (chronoDateParse[0].start.impliedValues.hasOwnProperty("hour")) { // no time specified
      
      return requestExplicitTimeOfDay(chronoDateParse, userData, qualifier, callback);

    } else { // time specified

      reminderData = { "StartDate": chronoDateParse[0].start.date() };

      // convert to UNIX
      reminderData["StartDate"] = moment.unix(reminderData["StartDate"])._i;

      // identify and add qualifier to reminderData
      reminderData = addQualifierToReminderData(reminderData, qualifier, callback);

      return saveReminderDataToDB(reminderData, userData, inputText, callback); // save to DB
    }
  }
}

function setMultipleDateReminderData(chronoDateParse, userData, qualifier, inputText, callback) {

  var reminderData = [];
  var lastObject = chronoDateParse.length - 1;

  // NOTE: doesn't account for multiple date/time combos
  if (chronoDateParse[lastObject].end) { // has a time range

    var parsedKnownTime = parseChronoKnownTimeValues(chronoDateParse[lastObject], callback);

    reminderData = mergeDateAndTime(chronoDateParse, parsedKnownTime, callback);

    // identify and add qualifier to reminderData
    reminderData = addQualifierToReminderData(reminderData, qualifier, callback);

    return saveReminderDataToDB(reminderData, userData, inputText, callback); // save to DB

  } else { // no time range specified

    if (chronoDateParse[lastObject].start.impliedValues.hasOwnProperty("hour")) { // no time specified
      
      // TODO: save qualifier too
      return requestExplicitTimeOfDay(chronoDateParse, userData, qualifier, callback);

    } else { // time specified

      var parsedKnownTime = parseChronoKnownTimeValues(chronoDateParse[lastObject], callback);

      reminderData = mergeDateAndTime(chronoDateParse, parsedKnownTime, callback);

      // identify and add qualifier to reminderData
      reminderData = addQualifierToReminderData(reminderData, qualifier, callback);

      return saveReminderDataToDB(reminderData, userData, inputText, callback); // save to DB
    }
  }
}

// parses out the hour, minute, and second for the last DATE's start/end
// as long as they are explicitly defined
function parseChronoKnownTimeValues(chronoDateParse, callback) {
  // chronoDateParse will be chronoDateParse[n] if multiple objects
  // otherwise will be chronoDateParse[0]
  // NOTE: currently makes the assumption no additional times will get specified in prior objects (dates)

  var startDate = chronoDateParse.start.knownValues;
  if (chronoDateParse.end) {
    var endDate = chronoDateParse.end.knownValues;
  }

  var parsedKnownTime = [];

  parsedKnownTime[0] = {
    "hour": startDate["hour"],
    "minute": startDate["minute"],
    "second": startDate["second"]
  };

  if (chronoDateParse.end) {
    parsedKnownTime[1] = {
      "hour": endDate["hour"],
      "minute": endDate["minute"],
      "second": endDate["second"]
    };
  }

  console.log("known time values");
  console.log(parsedKnownTime);
  return parsedKnownTime;
}

// merges the date with times (for multiple days specified)
function mergeDateAndTime(chronoDateParse, parsedKnownTime, callback){
  // chronoDateParse[i] >> counts through the various identified ParsedResults
  // parsedKnownTime[0] (START time), parsedKnownTime[1] (STOP time)

  var reminderData = [];
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

    reminderData[i] = {
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
      reminderData[i]["EndDate"] = moment([ 
        endDate[i]["year"],
        endDate[i]["month"]-1, // bug-ish
        endDate[i]["day"],
        endDate[i]["hour"],
        endDate[i]["minute"],
        endDate[i]["second"]
      ])._d;
    }
  }

  console.log("merged reminder data");
  console.log(reminderData);
  
  for (var i = 0; i < reminderData.length; i++) {
    if (reminderData[i]["EndDate"]) {
      reminderData[i]["EndDate"] = moment.unix(reminderData[i]["EndDate"])._i;
    }
    reminderData[i]["StartDate"] = moment.unix(reminderData[i]["StartDate"])._i;
  }

  return reminderData;
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

function addQualifierToReminderData(reminderData, qualifier, callback) {

  // identify and add qualifier to reminderData
  switch(qualifier) {
    case 'persistent':
      if (reminderData.length > 1) {
        for (var i = 0; i < reminderData.length; i++) {
          reminderData[i]["Persistent"] = true;
        }
      } else {
        reminderData["Persistent"] = true;
      }
      break;
    case 'repeat':
      if (reminderData.length > 1) {
        for (var i = 0; i < reminderData.length; i++) {
          reminderData[i]["Repeat"] = "weekly";
        }
      } else {
        reminderData["Repeat"] = "weekly";
      }
      break;
    case 'alternating':
      if (reminderData.length > 1) {
        for (var i = 0; i < reminderData.length; i++) {
          reminderData[i]["Repeat"] = "bi-weekly";
        }
      } else {
        reminderData["Repeat"] = "bi-weekly";
      }
      break;
  }

  console.log("add qualifier if present");
  console.log(reminderData);
  return reminderData;
}

// texts user for a specific time of day when setting the reminderTime
function requestExplicitTimeOfDay(chronoDateParse, userData, qualifier, callback) {
  // need to create a placeholder variable to know to pick up here on response
  // Step = time_of_day

  chronoDateParse["qualifier"] = qualifier;

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

  dynamo.updateItem(params, message, callback);
  return callback;
}

// TODOS in this FUNCTION
// called by handler if UserData.Step = "time_of_day"
// associates a time with a specified day
function saveExplicitTimeOfDay(inputText, UserData, callback) {
  console.log(UserData.TempData);
  console.log(UserData.Step);

  var chronoDateParse = UserData.TempData, message;

  if (inputText == 'no') {
    message = "Got it. This will be included in your daily reminder only.";

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

function saveReminderDataToDB(reminderData, userData, inputText, callback) {

  var timestamp = moment().unix();

  if (_.isEmpty(reminderData)) { // no reminder date or time specified/detected
    var message = "Thanks! You'll be reminded each day until deleted.";
  } else {
    // TODO: add in randomized responses
    var message = "Roger, todo saved."; // repeat it back to them (to verify)
  }

  // set Archive params
  var archiveParams = {
    "Phone": userData.Phone,
    "DateCreated": timestamp,
    "Input": inputText,
    "Todo": reminderData
  };

  // adds DateCreated and Input keys for todoParams
  reminderData["DateCreated"] = timestamp;
  reminderData["Input"] = inputText;

  // set Todo params
  var todoParams = {
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

  dynamo.createItem(archiveParams, 'archive', null); // saves to archive DB

  return dynamo.updateItem(todoParams, message, callback); // saves to user's todos, returns message
  
}

module.exports = {
  processReminder: processReminder,
  saveExplicitTimeOfDay: saveExplicitTimeOfDay
}