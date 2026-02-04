const pAlterTable = require('./alter_table/index.cjs');
const pCreateIndex = require('./create_index/index.cjs');
const pCreateTable = require('./create_table/index.cjs');
const pCommentSyntax = require('./comments/index.cjs');

module.exports = {
  pAlterTable,
  pCreateIndex,
  pCreateTable,
  pCommentSyntax,
};
