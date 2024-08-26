import {
  FieldsDictionary,
  IndexesDictionary,
  Table,
  TableConstraintsDictionary,
} from '../connectors/types';

export function getIntersection<T>(firstList: T[], secondList: T[]): T[] {
  return firstList.filter((item) => secondList.includes(item));
}

export function getTableSchemaKey(schemaName: string, tableName: string) {
  if (!tableName || !tableName.trim()) {
    throw new Error('Table name must be a non-empty string');
  }

  return schemaName ? `${schemaName}.${tableName}` : `${tableName}`;
}

export function mergeTables(firstTableList: Table[], secondTable: Table[]): Table[] {
  return firstTableList.concat(secondTable);
}

export function mergeFieldDictionary(
  firstDict: FieldsDictionary,
  secondDict: FieldsDictionary
): FieldsDictionary {
  const result: FieldsDictionary = Object.assign({}, firstDict);

  Object.keys(secondDict).forEach((key) => {
    if (!result[key]) {
      result[key] = [];
    }

    result[key] = result[key].concat(secondDict[key]);
  });

  return result;
}

export function mergeIndexDictionary(
  firstDict: IndexesDictionary,
  secondDict: IndexesDictionary
): IndexesDictionary {
  const result: IndexesDictionary = Object.assign({}, firstDict);

  Object.keys(secondDict).forEach((key) => {
    if (!result[key]) {
      result[key] = [];
    }

    result[key] = result[key].concat(secondDict[key]);
  });

  return result;
}

export function mergeTableConstraintDictionary(
  firstDict: TableConstraintsDictionary,
  secondDict: TableConstraintsDictionary
): TableConstraintsDictionary {
  const result: TableConstraintsDictionary = Object.assign({}, firstDict);

  Object.keys(secondDict).forEach((key) => {
    if (!result[key]) {
      result[key] = {};
    }

    result[key] = secondDict[key];
  });

  return result;
}
