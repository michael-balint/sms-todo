// dynamo.js
// manages the DynamoDB tables
// =============

var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB.DocumentClient();

var config = require('../config.json');

// creates a new item in the USER TABLE
function createItem(params, table, callback) {
  
  var tableName;
  if (table == 'users') { tableName = config.DB_TABLE_USERS; }
  else if (table == 'todos') { tableName = config.DB_TABLE_TODOS; }

  db.put({
    "TableName": tableName,
    "Item": params
  }, (err, data) => {
    if (err) {
      console.error("Error initializing TABLE item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("TABLE item initialized successfully (DynamoDB bug, no data returned, requires calling searchForUserData again):", JSON.stringify(data, null, 2));
      if (table == 'users') {
        var params = { phone: params.Phone }
        return searchForItem(params, callback);
      } else {
        return callback(null, 'Got it, task saved!');
      }
    }
  });
}

// searches for an ITEM in the TABLE, if not found, creates a new ITEM
function searchForItem(params, table, callback) {
  
  var tableName;
  if (table == 'users') { tableName = config.DB_TABLE_USERS; }
  else if (table == 'todos') { tableName = config.DB_TABLE_TODOS; }

  db.get({
    "TableName": tableName,
    "Key": {
      "Phone": params.phone
    }
  }, (err, data) => {
    if (err) {
      console.error("TABLE GET call unsuccessful. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      if (!data.Item) { // checks to see if USER TABLE item exists

        // TODO: check to see if the user was invited

        data.Phone = params.phone;
        data.NewUser = true;
        data.UserName = toTitleCase(params.inputText);
        console.log("No TABLE item found, creating a new item:", JSON.stringify(data, null, 2));
        return createItem(data, 'users', callback);
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

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

module.exports = {
  createItem: createItem,
  searchForItem: searchForItem,
  updateItem: updateItem
};