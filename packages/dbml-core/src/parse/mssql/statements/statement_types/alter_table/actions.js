const _ = require('lodash');
const { getFullTableName } = require('../../../utils');

function handleRef (tableName, result) {
  const endpointWithNoTableName = result.value.endpoints.find((ele) => !ele.tableName);
  endpointWithNoTableName.tableName = tableName.name;
  endpointWithNoTableName.schemaName = tableName.schemaName;
}

function addTableName (tableName, result) {
  result.value.tableName = tableName.name;
  result.value.schemaName = tableName.schemaName;
}

function handleAlterTableResult (_keyword, tableName, results) {
  if (!results) return null;
  const fullName = getFullTableName(tableName);

  results.forEach((result) => {
    if (result) {
      switch (result.type) {
        case 'refs':
          handleRef(fullName, result);
          break;
        case 'indexes':
        case 'dbdefault':
        case 'enums':
          addTableName(fullName, result);
          break;
        default:
          break;
      }
    }
  });
  return results;
}

module.exports = {
  handleAlterTableResult,
};
