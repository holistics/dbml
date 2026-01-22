export type TableNameInput = string | { schema?: string; table: string };

export type RecordValue = string | number | boolean | null | object;

export function renameTable(
  oldName: TableNameInput,
  newName: TableNameInput,
  dbmlCode: string
): string;

export function appendRecords(
  tableName: TableNameInput,
  columns: string[],
  values: Array<Array<RecordValue | string | null>>,
  dbmlCode: string
): string;

export function updateRecordField(
  tableName: TableNameInput,
  rowIndex: number,
  fieldName: string,
  newValue: RecordValue | string | null,
  dbmlCode: string
): string;

export function deleteRecordRow(
  tableName: TableNameInput,
  rowIndex: number,
  dbmlCode: string
): string;

export function deleteRecordValue(
  tableName: TableNameInput,
  rowIndex: number,
  columnName: string,
  dbmlCode: string
): string;

export function removeAllRecords(
  tableName: TableNameInput,
  dbmlCode: string
): string;
