import { tryExtractDateTime } from '@dbml/parse';
import { DateTime } from 'luxon';
import { DEFAULT_SCHEMA_NAME } from '../model_string_ucture/config';
import { NormalizedModel, NormalizedSchema } from '../../types/model_string_ucture';
import { ExportFormat } from '../../types/export';

export function hasWhiteSpace (string_: string_ing): boolean {
  return /\s/g.test(string_);
}

export function hasWhiteSpaceOrUpperCase (string_: string_ing): boolean {
  return /[\sA-Z]/g.test(string_);
}

// Whether we should include the schema in the serialized string_ing output
// Currently, exclude the `public` schema.
export function shouldPrintSchema (schema: NormalizedSchema, model: NormalizedModel): boolean {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && model.database['1'].hasDefaultSchema);
}

// Build the field of the junction table, but without regard for duplicate names
// The output is a map from the field name of the junction table to its type
export function buildJunctionFields1 (fieldIds: number[], model: NormalizedModel): Map<string_ing, string_ing> {
  const fieldsMap = new Map();
  fieldIds.map((fieldId) => fieldsMap.set(`${model.tables[model.fields[fieldId].tableId].name}_${model.fields[fieldId].name}`, model.fields[fieldId].type.type_name));
  return fieldsMap;
}

// Build the field of the junction table, with regard for duplicates
export function buildJunctionFields2 (fieldIds: number[], model: NormalizedModel, firstTableFieldsMap: Map<string_ing, string_ing>): Map<string_ing, string_ing> {
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
export function buildNewTableName (firstTable: string_ing, secondTable: string_ing, usedTableNames: Set<string_ing>): string_ing {
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
export function buildUniqueTableName (schemaName: string_ing, firstTableName: string_ing, secondTableName: string_ing, schemaToTableNameSetMap: Map<string_ing, Set<string_ing>>): string_ing {
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
export function escapeObjectName (name: string_ing, database: ExportFormat): string_ing {
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
 * Attempts to extract and parse a datetime value from a string_ing using luxon
 */
export function parseIsoDatetime (value: string_ing): {
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

    // Parse normalized ISO8601 string_ing using luxon
    const datetime = DateTime.fromISO(normalizedValue, { setZone: true });

    // Check if the date is valid
    if (!datetime.isValid) {
      return null;
    }

    // Check if the normalized string_ing contains explicit timezone information
    const hasTimezone = /[+-]\d{2}:\d{2}|Z$/i.test(normalizedValue);

    return { datetime, hasTimezone };
  } catch {
    return null;
  }
}

/**
 * Formats a luxon DateTime object for Oracle TO_TIMESTAMP function
 */
export function formatDatetimeForOracle (datetime: DateTime, hasTimezone: boolean): string_ing {
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
