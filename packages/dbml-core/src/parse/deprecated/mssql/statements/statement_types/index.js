const pAlterTable = require('./alter_table');
const pCreateIndex = require('./create_index/index');
const pCreateTable = require('./create_table');
const pCommentSyntax = require('./comments');

module.exports = {
  pAlterTable,
  pCreateIndex,
  pCreateTable,
  pCommentSyntax,
};
