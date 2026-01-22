import { DEFAULT_SCHEMA_NAME } from '../model_structure/config';
import {
  isNumericType,
  isBooleanType,
  isDateTimeType,
  tryExtractBoolean,
  tryExtractNumeric,
  tryExtractString,
  tryExtractDateTime,
} from '@dbml/parse';

export function hasWhiteSpace (s) {
  return /\s/g.test(s);
}

export function hasWhiteSpaceOrUpperCase (s) {
  return /[\sA-Z]/g.test(s);
}

export function shouldPrintSchema (schema, model) {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && model.database['1'].hasDefaultSchema);
}

export function buildJunctionFields1 (fieldIds, model) {
  const fieldsMap = new Map();
  fieldIds.map((fieldId) => fieldsMap.set(`${model.tables[model.fields[fieldId].tableId].name}_${model.fields[fieldId].name}`, model.fields[fieldId].type.type_name));
  return fieldsMap;
}

export function buildJunctionFields2 (fieldIds, model, firstTableFieldsMap) {
  const fieldsMap = new Map();
  fieldIds.forEach((fieldId) => {
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

/**
 *
 * @param {string} schemaName
 * @param {string} firstTableName
 * @param {string} secondTableName
 * @param {Map<string, Set>} schemaToTableNameSetMap
 * @returns string
 * @description This function is a clone version of the buildNewTableName, but without side effect - update the original usedTableNames
 */
export function buildUniqueTableName (schemaName, firstTableName, secondTableName, schemaToTableNameSetMap) {
  let newTableName = `${firstTableName}_${secondTableName}`;
  let count = 1;

  const tableNameSet = schemaToTableNameSetMap.get(schemaName);
  if (!tableNameSet) {
    return newTableName;
  }

  while (tableNameSet.has(newTableName)) {
    newTableName = `${firstTableName}_${secondTableName}(${count})`;
    count += 1;
  }
  return newTableName;
}

export function escapeObjectName (name, database) {
  if (!name) {
    return '';
  }

  let escapeSignature = '';

  switch (database) {
    case 'mysql':
      escapeSignature = '`';
      break;
    case 'postgres':
    case 'oracle':
      escapeSignature = '"';
      break;
    default:
      break;
  }

  return `${escapeSignature}${name}${escapeSignature}`;
}

export function formatRecordValue (recordValue) {
  const { value, type } = recordValue;

  // Handle null/undefined values
  if (value === null || value === undefined) {
    return 'null';
  }

  // Handle expressions (backtick strings)
  if (type === 'expression') {
    return `\`${value}\``;
  }

  // Try to extract typed values using tryExtract functions
  // If extraction fails, fall back to function expression

  if (isBooleanType(type)) {
    const extracted = tryExtractBoolean(value);
    if (extracted !== null) {
      return extracted ? 'true' : 'false';
    }
    // If extraction failed, wrap in function expression
    return `\`${value}\``;
  }

  if (isNumericType(type)) {
    const extracted = tryExtractNumeric(value);
    if (extracted !== null) {
      return String(extracted);
    }
    // If extraction failed, wrap in function expression
    return `\`${value}\``;
  }

  if (isDateTimeType(type)) {
    const extracted = tryExtractDateTime(value);
    if (extracted !== null) {
      const quote = extracted.includes('\n') ? '\'\'\'' : '\'';
      return `${quote}${extracted.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}${quote}`;
    }
    // If extraction failed, wrap in function expression
    return `\`${value}\``;
  }

  // Default: string types and others
  const extracted = tryExtractString(value);
  if (extracted !== null) {
    const quote = extracted.includes('\n') ? '\'\'\'' : '\'';
    return `${quote}${extracted.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}${quote}`;
  }

  // If all extractions failed, wrap in function expression
  return `\`${value}\``;
}
