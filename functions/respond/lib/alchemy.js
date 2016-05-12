// alchemy.js
// =============

// AlchemyAPI functions
// TODO: only handles one subject, need to add in conditions for multiple subjects (break into multiple todos? not for now)

var watson = require('watson-developer-cloud');
var alchemyCreds = require('../alchemy-creds.json');
var alchemy_language = watson.alchemy_language(alchemyCreds);

// Relations Extraction
function alchemyRelations(nlpText, params, callback) {
  alchemy_language.relations(nlpText, (err, response) => {
    if (err) {
      console.log("Alchemy error:", err);
    } else {
      console.log(JSON.stringify(response.relations, null, 2));
      var relations = response.relations;
      console.log(params.ExpressionAttributeValues);
      params.ExpressionAttributeValues[":relations_sentence"] = relations.sentence;
      params.ExpressionAttributeValues[":relations_subject"] = relations.subject;
      params.ExpressionAttributeValues[":relations_action"] = relations.action;
      params.ExpressionAttributeValues[":relations_object"] = relations.object;
      return callback(null, params);
    }
  });
}

// Keyword / Terminology Extraction
function alchemyKeywords(nlpText, params, callback) {
  alchemy_language.keywords(nlpText, (err, response) => {
    if (err) {
      console.log("Alchemy error:", err);
    } else {
      console.log(JSON.stringify(response.keywords, null, 2));
      var keywords = response.keywords;
      params.ExpressionAttributeValues[":keyword"] = keywords.text;
      params.ExpressionAttributeValues[":keyword_relevance"] = parseFloat(keywords.relevance);
      return callback(null, params);
    }
  });
}

// Taxonomy
function alchemyTaxonomy(nlpText, params, callback) {
  alchemy_language.taxonomy(nlpText, (err, response) => {
    if (err) {
      console.log("Alchemy error:", err);
    } else {
      console.log(JSON.stringify(response.taxonomy, null, 2));
      var taxonomy = response.taxonomy;
      params.ExpressionAttributeValues[":tax"] = taxonomy.label;
      params.ExpressionAttributeValues[":tax_score"] = parseFloat(taxonomy.score);
      return callback(null, params);
    }
  });
}

module.exports = {
  alchemyRelations: alchemyRelations
  
}