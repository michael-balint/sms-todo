// user-table.js
// =============

var AWS = require('aws-sdk');
var db = new AWS.DynamoDB.DocumentClient();
AWS.config.update({region:'us-east-1'});

var config = require('./config.json');

module.exports = {

  // creates a new item in the USER TABLE
  initializeUserData: function(userData, callback) {
    db.put({
      "TableName": config.DB_TABLE_USERS,
      "Item": userData
    }, (err, data) => {
      if (err) {
        console.error("Error initializing USER TABLE item. Error JSON:", JSON.stringify(err, null, 2));
      } else {
        console.log("USER TABLE item initialized successfully (DynamoDB bug, no data returned, requires calling searchForUserData again):", JSON.stringify(data, null, 2));
        var params = {
          "phone": userData.Phone
        };
        return searchForUserData(params, callback); // required due to DynamoDB
      }
    });
  },

  // searches for an item in the USER TABLE, if not found, creates a new item
  searchForUserData: function(params, callback) {
    db.get({
      "TableName": config.DB_TABLE_USERS,
      "Key": {
        "Phone": params.phone
      }
    }, (err, data) => {
      if (err) {
        console.error("USER TABLE GET call unsuccessful. Error JSON:", JSON.stringify(err, null, 2));
      } else {
        if (!data.Item) { // checks to see if USER TABLE item exists
          data.Phone = params.phone;
          data.NewUser = true;
          data.UserName = toTitleCase(params.inputText);
          console.log("No USER TABLE item found, creating a new item:", JSON.stringify(data, null, 2));
          return initializeUserData(data, callback);
        } else {
          console.log("USER TABLE item found:", JSON.stringify(data.Item, null, 2));
          return callback(null, data.Item);
        }
      }
    });
  },

  // updates an item in the USER TABLE
  updateUserData: function(params, message, callback) {
    db.update(params, (err, data) => {
      if (err) {
        console.error("Error updating USER TABLE item. Error JSON:", JSON.stringify(err, null, 2));
      } else {
        console.log("USER TABLE item updated successfully:", JSON.stringify(data, null, 2));
        return callback(null, message);
      }
    });
  },
};

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}