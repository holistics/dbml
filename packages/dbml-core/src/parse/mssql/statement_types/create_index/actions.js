function makeIndex (_create, isUnique, _clustered, _index, indexName, _on, tableName, columnNames) {
  const columns = [];
  columnNames.forEach(columnName => {
    columns.push({
      value: columnName,
      type: 'column',
    });
  });
  return {
    type: 'indexes',
    value: {
      name: indexName,
      type: 'btree',
      unique: isUnique ? true : null,
      tableName: tableName[tableName.length - 1],
      columns,
    },
  };
}

module.exports = {
  makeIndex,
};
