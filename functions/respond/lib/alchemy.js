// alchemy.js
// =============

// AlchemyAPI functions
// TODO: only handles one subject, need to add in conditions for multiple
// subjects (break into multiple todos? not for now)

var watson = require('watson-developer-cloud');
var alchemyCreds = require('../alchemy-creds.json');
var alchemy_language = watson.alchemy_language(alchemyCreds);

// Relations Extraction
function alchemyRelations(text, params, callback) {
  alchemy_language.relations(text, (err, response) => {
    if (err) {
      console.log("Alchemy error:", err);
    } else {
      console.log(JSON.stringify(response.relations, null, 2));
      params["Relations"] = response.relations;
      return callback(null, params);
    }
  });
}

// Keyword / Terminology Extraction
function alchemyKeywords(text, params, callback) {
  alchemy_language.keywords(text, (err, response) => {
    if (err) {
      console.log("Alchemy error:", err);
    } else {
      console.log(JSON.stringify(response.keywords, null, 2));
      params["Keywords"] = response.keywords;
      return callback(null, params);
    }
  });
}

// Taxonomy
function alchemyTaxonomy(text, params, callback) {
  alchemy_language.taxonomy(text, (err, response) => {
    if (err) {
      console.log("Alchemy error:", err);
    } else {
      console.log(JSON.stringify(response.taxonomy, null, 2));
      var taxonomy = [];
      for (var i = 0; i < response.taxonomy.length; i++) {
        if (!response.taxonomy[i].confident) {
          taxonomy.push(response.taxonomy[i]);
        };
      }
      params["Taxonomy"] = taxonomy;
      return callback(null, params);
    }
  });
}

module.exports = {
  alchemyRelations: alchemyRelations,
  alchemyKeywords: alchemyKeywords,
  alchemyTaxonomy: alchemyTaxonomy
}
