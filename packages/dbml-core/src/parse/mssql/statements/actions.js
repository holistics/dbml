function handleIndexes (index, ast) {
  const table = ast.tables.find(table => table.name === index.tableName);
  table.indexes.push(index);
  index.tableName = null;
}

function pushOut (values, astProp) {
  values.forEach(value => {
    astProp.push(value);
  });
}
function handleTable (table, ast) {
  pushOut(table.enums, ast.enums);
  pushOut(table.refs, ast.refs);
  table.enums = null;
  table.refs = null;
}
function handleStatement (statements) {
  const ast = {
    tables: [],
    refs: [],
    indexes: [],
    enums: [],
  };

  statements.forEach(statement => {
    if (!statement) return;
    switch (statement.type) {
      case 'tables':
        handleTable(statement.value, ast);
        break;
      case 'indexes':
        handleIndexes(statement.value, ast);
        break;
      default:
        break;
    }
    if (statement.type) ast[statement.type].push(statement.value);
  });
  ast.indexes = null;
  return ast;
}

module.exports = { handleStatement };
