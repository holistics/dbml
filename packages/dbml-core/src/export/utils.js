import { DEFAULT_SCHEMA_NAME } from '../model_structure/config';

export function hasWhiteSpace (s) {
  return /\s/g.test(s);
}

export function shouldPrintSchema (schema, model) {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && model.database['1'].hasDefaultSchema);
}


export function buildJunctionFields1 (fieldIds, model) {
  const fieldsMap = new Map();
  fieldIds.map(fieldId => fieldsMap.set(`${model.tables[model.fields[fieldId].tableId].name}_${model.fields[fieldId].name}`, model.fields[fieldId].type.type_name));
  return fieldsMap;
}

export function buildJunctionFields2 (fieldIds, model, firstTableFieldsMap) {
  const fieldsMap = new Map();
  fieldIds.map((fieldId) => {
    let fieldName = `${model.tables[model.fields[fieldId].tableId].name}_${model.fields[fieldId].name}`;
    let count = 1;
    while (firstTableFieldsMap.has(fieldName)) {
      fieldName = `${model.tables[model.fields[fieldId].tableId].name}_${model.fields[fieldId].name}(${count})`;
      count += 1;
    }
    fieldsMap.set(fieldName, model.fields[fieldId].type.type_name);
  });
  return fieldsMap;
}

export function buildNewTableName (firstTable, secondTable, usedTableNames) {
  let newTableName = `${firstTable}_${secondTable}`;
  let count = 1;
  while (usedTableNames.has(newTableName)) {
    newTableName = `${firstTable}_${secondTable}(${count})`;
    count += 1;
  }
  usedTableNames.add(newTableName);
  return newTableName;
}
