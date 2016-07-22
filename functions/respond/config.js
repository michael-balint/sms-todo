var PHONE = "+12023355133";
var DB_TABLE_NAME = "woodhouse";

function getDbTableName() {
  return `${DB_TABLE_NAME}-${process.env.SERVERLESS_STAGE}`;
}

function getDbArchiveTableName() {
  return `${DB_TABLE_NAME}-archive-${process.env.SERVERLESS_STAGE}`;
}

module.exports = {
  PHONE: PHONE,
  DB_TABLE_NAME: getDbTableName(),
  DB_TABLE_ARCHIVE: getDbArchiveTableName()
}
