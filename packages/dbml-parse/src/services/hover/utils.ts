import { Table, Column, RecordValue } from '@/core/interpreter/types';

const MAX_RECORDS_DISPLAY = 5;
const MAX_VALUES_DISPLAY = 10;

/**
 * Format table records for hover display
 */
export function formatRecordsForHover (table: Table, records: Record<string, RecordValue>[]): string {
  const displayCount = Math.min(records.length, MAX_RECORDS_DISPLAY);
  const columns = table.fields.map((f) => f.name);

  let markdown = `**Table: ${table.name}**\n\n`;
  markdown += `Sample Records (${displayCount} of ${records.length}):\n\n`;

  // Create table header
  markdown += '| ' + columns.join(' | ') + ' |\n';
  markdown += '| ' + columns.map(() => '---').join(' | ') + ' |\n';

  // Add sample rows
  for (let i = 0; i < displayCount; i++) {
    const record = records[i];
    const values = columns.map((col) => formatRecordValue(record[col]));
    markdown += '| ' + values.join(' | ') + ' |\n';
  }

  if (records.length > MAX_RECORDS_DISPLAY) {
    markdown += `\n... and ${records.length - MAX_RECORDS_DISPLAY} more records`;
  }

  return markdown;
}

/**
 * Format column values for hover display
 */
export function formatColumnValuesForHover (
  column: Column,
  records: Record<string, RecordValue>[],
  columnName: string,
): string {
  const displayCount = Math.min(records.length, MAX_VALUES_DISPLAY);

  let markdown = `**Column: ${column.name}**\n\n`;
  markdown += `Type: \`${column.type.type_name}\`\n\n`;

  markdown += `Example Values (${displayCount} of ${records.length}):\n\n`;

  for (let i = 0; i < displayCount; i++) {
    const record = records[i];
    const value = record[columnName];
    markdown += `- ${formatRecordValue(value)}\n`;
  }

  if (records.length > MAX_VALUES_DISPLAY) {
    markdown += `\n... and ${records.length - MAX_VALUES_DISPLAY} more values`;
  }

  return markdown;
}

/**
 * Format a single record value for display
 */
function formatRecordValue (value: RecordValue | undefined): string {
  if (!value) {
    return '*null*';
  }

  if (value.is_expression) {
    return `\`${value.value}\``;
  }

  if (value.value === null) {
    return '*null*';
  }

  switch (value.type) {
    case 'string':
      return `"${value.value}"`;
    case 'bool':
      return value.value ? 'true' : 'false';
    case 'integer':
    case 'real':
      return String(value.value);
    case 'date':
    case 'time':
    case 'datetime':
      return `\`${value.value}\``;
    default:
      return String(value.value);
  }
}
