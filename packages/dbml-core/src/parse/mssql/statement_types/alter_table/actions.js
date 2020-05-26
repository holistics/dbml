const _ = require('lodash');

function handleRef (tableName, result) {
  const endpointWithNoTableName = result.value.endpoints.find(ele => !ele.tableName);
  endpointWithNoTableName.tableName = _.last(tableName);
}

function handleAlterTableResult (_keyword, tableName, result) {
  if (!result) return null;
  switch (result.type) {
    case 'refs':
      handleRef(tableName, result);
      break;

    default:
      break;
  }
  return result;
}

module.exports = {
  handleAlterTableResult,
};
