// dynamo.js
// manages the DynamoDB tables
// =============

var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB.DocumentClient();

var config = require('../config.json');

// creates a new item in the USER TABLE
function createItem(params, callback) {
  
  var dbParams = setDBParams(params, 'create');

  db.put(dbParams, (err, data) => {
    if (err) {
      console.error("Error initializing TABLE item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("TABLE item initialized successfully (DynamoDB bug, no data returned, requires calling searchForUserData again):", JSON.stringify(data, null, 2));
      return searchForItem(params, 'users', callback);
    }
  });
}

// searches for an ITEM in the TABLE, if not found, creates a new ITEM
function searchForItem(params, callback) {
  
  var dbParams = setDBParams(params, 'search');

  db.get(dbParams, (err, data) => {
    if (err) {
      console.error("TABLE GET call unsuccessful. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      if (!data.Item) { // checks to see if USER TABLE item exists

        // TODO: check to see if the user was invited

        data.Phone = params.Phone;
        data.Todos = [];
        data.NewUser = true;
        data.UserName = toTitleCase(params.inputText);
        console.log("No TABLE item found, creating a new item:", JSON.stringify(data, null, 2));
        return createItem(data, callback);
      } else {
        console.log("TABLE item found:", JSON.stringify(data.Item, null, 2));
        return callback(null, data.Item);
      }
    }
  });
}

// updates an ITEM in the TABLE
function updateItem(params, message, callback) {

  db.update(params, (err, data) => {
    if (err) {
      console.error("Error updating TABLE item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("TABLE item updated successfully:", JSON.stringify(data, null, 2));
      return callback(null, message);
    }
  });
}

function deleteElement(params, callback){

  db.update(params, (err, data) => {
    if (err) {
      console.error("Error deleting TABLE item ELEMENT. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("TABLE item ELEMENT deleted successfully:", JSON.stringify(data, null, 2));
      return callback(null, "Todo successfully deleted.");
    }
  });
}

// sets the DB params for GET and PUT
function setDBParams(params, action) { // removed table string

  var dbItem = {
    "TableName": config.DB_TABLE_NAME
  };

  // SEARCH function
  if (action == 'search') { dbItem["Key"] = { "Phone": params.Phone }; }

  // CREATE function
  else if (action == 'create') { dbItem["Item"] = params; }

  return dbItem;
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

module.exports = {
  createItem: createItem,
  searchForItem: searchForItem,
  updateItem: updateItem,
  deleteElement: deleteElement
};
