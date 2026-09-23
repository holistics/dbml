import { tryExtractDateTime } from '@dbml/parse';
import { DateTime } from 'luxon';
import { DEFAULT_SCHEMA_NAME } from '../model_structure/config';
import { NormalizedModel, NormalizedSchema } from '../../types/model_structure';
import { ExportFormat } from '../../types/export';

export function hasWhiteSpace (s: string): boolean {
  return /\s/g.test(s);
}

export function hasWhiteSpaceOrUpperCase (s: string): boolean {
  return /[\sA-Z]/g.test(s);
}

// Whether we should include the schema in the serialized string output
// Currently, exclude the `public` schema.
export function shouldPrintSchema (schema: NormalizedSchema, model: NormalizedModel): boolean {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && model.database['1'].hasDefaultSchema);
}

// Build the field of the junction table, but without regard for duplicate names
// The output is a map from the field name of the junction table to its type
export function buildJunctionFields1 (fieldIds: number[], model: NormalizedModel): Map<string, string> {
  const fieldsMap = new Map();
  fieldIds.map((fieldId) => fieldsMap.set(`${model.tables[model.fields[fieldId].tableId].name}_${model.fields[fieldId].name}`, model.fields[fieldId].type.type_name));
  return fieldsMap;
}

// Build the field of the junction table, with regard for duplicates
export function buildJunctionFields2 (fieldIds: number[], model: NormalizedModel, firstTableFieldsMap: Map<string, string>): Map<string, string> {
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

// Build the name of a junction table
// But with a set to avoid duplicate table names
export function buildNewTableName (firstTable: string, secondTable: string, usedTableNames: Set<string>): string {
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
 * This function does the same as buildNewTableName, but without side effect - update the original usedTableNames
 */
export function buildUniqueTableName (schemaName: string, firstTableName: string, secondTableName: string, schemaToTableNameSetMap: Map<string, Set<string>>): string {
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

// Escape names of tables, etc in SQL
export function escapeObjectName (name: string, database: ExportFormat): string {
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

/**
 * Attempts to extract and parse a datetime value from a string using luxon
 */
export function parseIsoDatetime (value: string): {
  datetime: DateTime;
  hasTimezone: boolean;
} | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    // First normalize to ISO format using tryExtractDateTime
    // This handles IsoDate, IsoTime, and IsoDateTime formats
    const normalizedValue = tryExtractDateTime(value);
    if (!normalizedValue) {
      return null;
    }

    // Parse normalized ISO8601 string using luxon
    const datetime = DateTime.fromISO(normalizedValue, { setZone: true });

    // Check if the date is valid
    if (!datetime.isValid) {
      return null;
    }

    // Check if the normalized string contains explicit timezone information
    const hasTimezone = /[+-]\d{2}:\d{2}|Z$/i.test(normalizedValue);

    return { datetime, hasTimezone };
  } catch {
    return null;
  }
}

/**
 * Formats a luxon DateTime object for Oracle TO_TIMESTAMP function
 */
export function formatDatetimeForOracle (datetime: DateTime, hasTimezone: boolean): string {
  if (hasTimezone) {
    // Format with timezone: YYYY-MM-DD HH24:MI:SS.FF3 TZH:TZM
    // Oracle expects the timezone offset in +HH:MM or -HH:MM format
    const formatted = datetime.toFormat('yyyy-MM-dd HH:mm:ss.SSS ZZ');
    return formatted;
  }

  // Format without timezone: YYYY-MM-DD HH24:MI:SS.FF3
  // Convert to UTC when no timezone is present
  const formatted = datetime.toUTC().toFormat('yyyy-MM-dd HH:mm:ss.SSS');
  return formatted;
}
