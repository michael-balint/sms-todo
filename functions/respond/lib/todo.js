// todo.js
// =============

var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB.DocumentClient();

var config = require('../config.json');

module.exports = {

  // creates a new item in the TODO TABLE
  createTodo: function(params, callback) {
    db.put({
      "TableName": config.DB_TABLE_TODOS,
      "Item": params
    }, (err, data) => {
      if (err) {
        console.error("Error initializing TODO TABLE item. Error JSON:", JSON.stringify(err, null, 2));
      } else {
        console.log("TODO TABLE item initialized successfully (DynamoDB bug, no data returned, requires calling searchForUserData again):", JSON.stringify(data, null, 2));
        return self.searchForTodo(params, callback); // required due to DynamoDB
      }
    });
  },

  // searches for an item in the TODO TABLE, if not found, creates a new item
  searchForTodo: function(params, callback) {
    db.get({
      "TableName": config.DB_TABLE_TODOS,
      "Key": {
        "Phone": params.phone,
        "Date": params.date
      }
    }, (err, data) => {
      if (err) {
        console.error("TODO TABLE GET call unsuccessful. Error JSON:", JSON.stringify(err, null, 2));
      } else {
        if (!data.Item) { // checks to see if TODO TABLE item exists
          data.Phone = params.phone;
          data.Date = params.date;
          // fill out the rest of this
          console.log("No TODO TABLE item found, creating a new item:", JSON.stringify(data, null, 2));
          return self.createTodo(data, callback);
        } else {
          console.log("TODO TABLE item found:", JSON.stringify(data.Item, null, 2));
          return callback(null, data.Item);
        }
      }
    });
  },

  // updates an item in the TODO TABLE
  updateTodo: function(params, message, callback) {
    db.update(params, (err, data) => {
      if (err) {
        console.error("Error updating TODO TABLE item. Error JSON:", JSON.stringify(err, null, 2));
      } else {
        console.log("TODO TABLE item updated successfully:", JSON.stringify(data, null, 2));
        return callback(null, message);
      }
    });
  }

};