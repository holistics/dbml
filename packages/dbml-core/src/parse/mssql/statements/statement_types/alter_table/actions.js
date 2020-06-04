const _ = require('lodash');

function handleRef (tableName, result) {
  const endpointWithNoTableName = result.value.endpoints.find(ele => !ele.tableName);
  endpointWithNoTableName.tableName = _.last(tableName);
}

function addTableName (tableName, result) {
  result.value.tableName = _.last(tableName);
}

function handleAlterTableResult (_keyword, tableName, results) {
  if (!results) return null;
  // eslint-disable-next-line consistent-return
  results.forEach((result) => {
    if (result) {
      switch (result.type) {
        case 'refs':
          handleRef(tableName, result);
          break;
        case 'indexes':
        case 'dbdefault':
        case 'enums':
          addTableName(tableName, result);
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
