const _ = require('lodash');

function createRefFromInlineRef (linesRefs, inlineRef, fieldName, tableName) {
  if (!inlineRef || inlineRef.length === 0) return;
  const newRef = {};
  newRef.onUpdate = inlineRef.onUpdate;
  newRef.onDelete = inlineRef.onDelete;

  newRef.endpoints = [];
  newRef.endpoints.push(inlineRef.endpoint);
  newRef.endpoints.push({
    tableName,
    fieldName: [fieldName],
    relation: '*',
  });
  linesRefs.push(newRef);
}

function pushOutEnum (linesEnums, fieldValue, tableName) {
  if (fieldValue.enums) {
    const _enum = fieldValue.enums;
    const fieldType = fieldValue.type;
    _enum.name = `${tableName}_${fieldValue.enums.name}`;
    fieldType.type_name = _enum.name;
    fieldType.args = _enum.values.map(value => `'${value.name}'`).join(', ');
    linesEnums.push(_enum);
    fieldValue.enums = null;
  }
}

function pushOutIndex (linesIndexes, fieldValue) {
  if (fieldValue.indexes) {
    fieldValue.indexes.columns.push({
      value: fieldValue.name,
      type: 'column',
    });
    linesIndexes.push(fieldValue.indexes);
    fieldValue.indexes = null;
  }
}
function getLinesValue (lines, tableName) {
  const value = {
    fields: [],
    enums: [],
    refs: [],
    indexes: [],
  };
  lines.forEach(line => {
    if (line && value[line.type]) {
      if (line.type === 'fields') {
        pushOutEnum(value.enums, line.value, tableName);
        pushOutIndex(value.indexes, line.value);
        createRefFromInlineRef(value.refs, line.value.inline_refs, tableName);
      }
      if (line.type === 'refs') {
        const ref = line.value;
        ref.endpoints[0].tableName = tableName;
      }
      value[line.type].push(line.value);
    }
  });
  return {
    type: 'lines',
    value,
  };
}

function makeTable (_keyword, tableName, _keyword2, lines) {
  const linesValue = getLinesValue(lines, _.last(tableName));
  return {
    type: 'tables',
    value: {
      name: _.last(tableName),
      ...linesValue.value,
      schemaName: tableName.length > 1 ? tableName[tableName.length - 2] : null,
    },
  };
}

module.exports = {
  makeTable,
};
