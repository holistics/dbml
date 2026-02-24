import { tryExtractDateTime } from '@dbml/parse';
import { DEFAULT_SCHEMA_NAME } from '../model_structure/config';
import { DateTime } from 'luxon';
import { NormalizedModel } from '../model_structure/database';
import { NormalizedSchema } from '../model_structure/schema';

export interface CommentNode {
  type: 'table' | 'column';
  tableId: number;
  fieldId?: number;
}

export function hasWhiteSpace (s: string): boolean {
  return /\s/g.test(s);
}

export function hasWhiteSpaceOrUpperCase (s: string): boolean {
  return /[\sA-Z]/g.test(s);
}

export function shouldPrintSchema (schema: NormalizedSchema, model: NormalizedModel): boolean {
  return schema.name !== DEFAULT_SCHEMA_NAME || (schema.name === DEFAULT_SCHEMA_NAME && model.database['1'].hasDefaultSchema);
}

export function buildJunctionFields1 (fieldIds: number[], model: NormalizedModel): Map<string, string> {
  const fieldsMap = new Map<string, string>();
  fieldIds.map((fieldId) => fieldsMap.set(`${model.tables[model.fields[fieldId].tableId].name}_${model.fields[fieldId].name}`, model.fields[fieldId].type.type_name));
  return fieldsMap;
}

export function buildJunctionFields2 (fieldIds: number[], model: NormalizedModel, firstTableFieldsMap: Map<string, string>): Map<string, string> {
  const fieldsMap = new Map<string, string>();
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
 *
 * @param {string} schemaName
 * @param {string} firstTableName
 * @param {string} secondTableName
 * @param {Map<string, Set>} schemaToTableNameSetMap
 * @returns string
 * @description This function is a clone version of the buildNewTableName, but without side effect - update the original usedTableNames
 */
export function buildUniqueTableName (schemaName: NormalizedSchema, firstTableName: string, secondTableName: string, schemaToTableNameSetMap: Map<NormalizedSchema, Set<string>>): string {
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

export function escapeObjectName (name: string, database: string): string {
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
 * @param {string} value - The datetime string to parse (supports various formats, normalized to ISO8601)
 * @returns {{ datetime: DateTime, hasTimezone: boolean } | null} Parsed datetime with timezone info, or null if invalid
 */
export function parseIsoDatetime (value: string): { datetime: DateTime; hasTimezone: boolean } | null {
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
 * @param {DateTime} datetime - The luxon DateTime to format
 * @param {boolean} hasTimezone - Whether to include timezone
 * @returns {string} Formatted datetime string for Oracle
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
