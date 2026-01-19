export function formatFullColumnName (
  schemaName: string | null,
  tableName: string,
  columnName: string,
): string {
  if (schemaName) {
    return `${schemaName}.${tableName}.${columnName}`;
  }
  return `${tableName}.${columnName}`;
}

export function formatFullColumnNames (
  schemaName: string | null,
  tableName: string,
  columnNames: string[],
): string {
  if (columnNames.length === 1) {
    return formatFullColumnName(schemaName, tableName, columnNames[0]);
  }
  const formatted = columnNames.map((col) => formatFullColumnName(schemaName, tableName, col));
  return `(${formatted.join(', ')})`;
}

export function pkDuplicateMessage (
  schemaName: string | null,
  tableName: string,
  columns: string[],
  values: Map<string, unknown>,
): string {
  const isComposite = columns.length > 1;
  const constraintType = isComposite ? 'Composite PK' : 'PK';
  const columnRef = formatFullColumnNames(schemaName, tableName, columns);

  if (isComposite) {
    const valueStr = columns.map((col) => JSON.stringify(values.get(col))).join(', ');
    return `Duplicate ${constraintType}: ${columnRef} = (${valueStr})`;
  }
  const value = JSON.stringify(values.get(columns[0]));
  return `Duplicate ${constraintType}: ${columnRef} = ${value}`;
}

export function pkNullMessage (
  schemaName: string | null,
  tableName: string,
  columns: string[],
): string {
  const isComposite = columns.length > 1;
  const constraintType = isComposite ? 'Composite PK' : 'PK';
  const columnRef = formatFullColumnNames(schemaName, tableName, columns);
  return `NULL in ${constraintType}: ${columnRef} cannot be NULL`;
}

export function pkMissingMessage (
  schemaName: string | null,
  tableName: string,
  columns: string[],
): string {
  const isComposite = columns.length > 1;
  const constraintType = isComposite ? 'Composite PK' : 'PK';
  const columnRef = formatFullColumnNames(schemaName, tableName, columns);
  return `${constraintType}: Column ${columnRef} is missing from record and has no default value`;
}

export function uniqueDuplicateMessage (
  schemaName: string | null,
  tableName: string,
  columns: string[],
  values: Map<string, unknown>,
): string {
  const isComposite = columns.length > 1;
  const constraintType = isComposite ? 'Composite UNIQUE' : 'UNIQUE';
  const columnRef = formatFullColumnNames(schemaName, tableName, columns);

  if (isComposite) {
    const valueStr = columns.map((col) => JSON.stringify(values.get(col))).join(', ');
    return `Duplicate ${constraintType}: ${columnRef} = (${valueStr})`;
  }
  const value = JSON.stringify(values.get(columns[0]));
  return `Duplicate ${constraintType}: ${columnRef} = ${value}`;
}

export function fkViolationMessage (
  sourceSchemaName: string | null,
  sourceTableName: string,
  sourceColumns: string[],
  sourceValues: Map<string, unknown>,
  targetSchemaName: string | null,
  targetTableName: string,
  targetColumns: string[],
): string {
  const isComposite = sourceColumns.length > 1;
  const sourceColumnRef = formatFullColumnNames(sourceSchemaName, sourceTableName, sourceColumns);
  const targetColumnRef = formatFullColumnNames(targetSchemaName, targetTableName, targetColumns);

  if (isComposite) {
    const valueStr = sourceColumns.map((col) => JSON.stringify(sourceValues.get(col))).join(', ');
    return `FK violation: ${sourceColumnRef} = (${valueStr}) does not exist in ${targetColumnRef}`;
  }
  const value = JSON.stringify(sourceValues.get(sourceColumns[0]));
  return `FK violation: ${sourceColumnRef} = ${value} does not exist in ${targetColumnRef}`;
}

export function notNullMessage (
  schemaName: string | null,
  tableName: string,
  columnName: string,
): string {
  const columnRef = formatFullColumnName(schemaName, tableName, columnName);
  return `NULL value: ${columnRef} is NOT NULL`;
}
