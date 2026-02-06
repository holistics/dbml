import { getFullTableName } from '../../../utils.js';

function makeIndex(_create, isUnique, _clustered, _index, indexName, _on, tableName, columnNames) {
  const fullTableName = getFullTableName(tableName);
  const columns = [];
  columnNames.forEach((columnName) => {
    columns.push({
      value: columnName,
      type: 'column',
    });
  });

  return {
    type: 'indexes',
    value: {
      name: indexName,
      unique: isUnique ? true : null,
      tableName: fullTableName.name,
      schemaName: fullTableName.schemaName,
      columns,
    },
  };
}

export {
  makeIndex,
};
