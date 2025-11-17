function makeIndex (columnNames, isUnique, isPk, indexName = null) {
  const columns = [];

  columnNames.forEach((column) => {
    columns.push({
      value: column,
      type: 'column',
    });
  });

  return {
    type: 'indexes',
    value: {
      name: indexName,
      unique: isUnique ? true : null,
      pk: isPk ? true : null,
      columns,
    },
  };
}

function makeColumnIndex (_keyword, indexName) {
  return {
    type: 'indexes',
    value: {
      name: indexName,
      columns: [
      ],
    },
  };
}

function makeTableIndex (_keyword, indexName, isUnique, _clustered, _columnstore, columnNames) {
  return makeIndex(columnNames, isUnique, null, indexName);
}

function makeTableConstraintIndex (keyword, _keyword, columnNames) {
  let isPk = null;
  let isUnique = null;

  if (keyword.type === 'pk') {
    isPk = true;
  } else if (keyword.type === 'unique') {
    isUnique = true;
  }

  return makeIndex(columnNames, isUnique, isPk);
}

module.exports = {
  makeTableIndex,
  makeTableConstraintIndex,
  makeColumnIndex,
};
