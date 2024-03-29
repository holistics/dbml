const _ = require('lodash');
const { getFullTableName } = require('../../../utils');

function createRefFromInlineRef (linesRefs, inlineRefs, fieldName, tableName) {
  if (!inlineRefs || inlineRefs.length === 0) return;
  const newRef = {};
  const inlineRef = inlineRefs[0];
  newRef.onUpdate = inlineRef.onUpdate;
  newRef.onDelete = inlineRef.onDelete;

  newRef.endpoints = [];
  newRef.endpoints.push({
    tableName: tableName.name,
    schemaName: tableName.schemaName,
    fieldNames: [fieldName],
    relation: '*',
  });
  if (!inlineRef.endpoint.fieldNames) {
    inlineRef.endpoint.fieldNames = newRef.endpoints[0].fieldNames;
  }
  newRef.endpoints.push(inlineRef.endpoint);
  linesRefs.push(newRef);
}

function pushOutEnum (linesEnums, fieldValue, tableName) {
  if (fieldValue.enums) {
    const _enum = fieldValue.enums;
    const fieldType = fieldValue.type;
    _enum.name = `${tableName.schemaName
      ? `${tableName.schemaName}_` : ''}${tableName.name}_${fieldValue.enums.name}`;
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
        createRefFromInlineRef(value.refs, line.value.inline_refs, line.value.name, tableName);
      }
      if (line.type === 'refs') {
        const ref = line.value;
        ref.endpoints[0].tableName = tableName.name;
        ref.endpoints[0].schemaName = tableName.schemaName;
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
  const fullName = getFullTableName(tableName);
  const linesValue = getLinesValue(lines, fullName);
  return {
    type: 'tables',
    value: {
      ...fullName,
      ...linesValue.value,
    },
  };
}

module.exports = {
  makeTable,
};
