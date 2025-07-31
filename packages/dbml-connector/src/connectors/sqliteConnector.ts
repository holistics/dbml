import type {Database} from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3'
import {
  DatabaseSchema,
  DefaultInfo,
  DefaultType,
  Enum,
  EnumValuesDict,
  Field,
  FieldsDictionary,
  IndexColumn,
  IndexesDictionary,
  Ref,
  Table,
  TableConstraint,
  TableConstraintsDictionary,
  TypeInfo
} from './types';

function connectSQLite(connection: string): Database {
  return new DatabaseConstructor(connection);
}

function getDbDefault(columnDefault: string | null, defaultValueType: DefaultType): DefaultInfo | null {
  if (columnDefault === null) {
    return null;
  }

  return {
    type: defaultValueType,
    value: columnDefault,
  };
}

function getFieldType(columnType: string): TypeInfo {
  return {
    type_name: columnType.toUpperCase(),
    schemaName: null,
  };
}

function generateField(tableName: string, columnsWithEnum: { [key: string]: Enum }, row: any): Field {
  const {
    name,
    type,
    notnull,
    dflt_value,
    pk,
  } = row;

  const defaultValueType: DefaultType = dflt_value && dflt_value.startsWith("'") && dflt_value.endsWith("'")
    ? 'string'
    : dflt_value === 'true' || dflt_value === 'false'
      ? 'boolean'
      : !isNaN(Number(dflt_value))
        ? 'number'
        : 'expression';

  // Either SQLite type or an Enum type
  let actualType = getFieldType(type)

  const key = `${tableName}.${name}`;
  if (columnsWithEnum[key]) {
    actualType = {
      type_name: columnsWithEnum[key].name,
      schemaName: 'main',
    }
  }

  return {
    name,
    type: actualType,
    dbdefault: getDbDefault(dflt_value, defaultValueType),
    not_null: notnull === 1,
    increment: type.toLowerCase() === 'integer' && pk === 1,
    pk: pk === 1,
    note: { value: '' },
  };
}

export function getEnumValues(definition: string, constraint_name: string): EnumValuesDict[] {
  if (!definition) return [];

  // Extract column names and their enum values from CHECK constraints
  // Example: "CHECK(column IN ('value1', 'value2', 'value3'))"

  // First, try to match the IN clause pattern
  const inClausePattern = /(\w+)\s+IN\s*\(([^)]+)\)/gi;
  let inMatches = [...definition.matchAll(inClausePattern)];

  // Second, try to match the OR pattern
  const orPattern = /(\w+)\s*=\s*'([^']+)'/gi;
  const orMatches = [...definition.matchAll(orPattern)];

  const colMap: { [key: string]: string[] } = {};

  // Process IN clause matches
  if (inMatches.length > 0) {
    inMatches.forEach(match => {
      const columnName = match[1];
      const valuesString = match[2];
      // Extract values from the string, handling quoted values
      const values = valuesString.split(',')
          .map(v => v.trim().replace(/^'|'$/g, ''));

      colMap[columnName] = values;
    });
  }
  // Process OR pattern matches
  if (orMatches.length > 0) {
    orMatches.forEach(match => {
      const columnName = match[1];
      const value = match[2];

      if (!colMap[columnName]) {
        colMap[columnName] = [value];
      } else if (!colMap[columnName].includes(value)) {
        colMap[columnName].push(value);
      }
    });
  }

  // If no matches found, return empty array
  if (Object.keys(colMap).length === 0) return [];

  // Check if multiple columns have the same set of enum values
  const arraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  };

  // Group columns with the same enum values
  const result: EnumValuesDict[] = [];
  const processedKeys = new Set<string>();

  Object.keys(colMap).forEach((key) => {
    if (processedKeys.has(key)) return;

    const mergedColumns = [key];
    const colValues = colMap[key];

    Object.keys(colMap).forEach((innerKey) => {
      if (key !== innerKey && arraysEqual(colValues, colMap[innerKey])) {
        mergedColumns.push(innerKey);
        processedKeys.add(innerKey);
      }
    });

    const enumValues = colValues.map((value) => ({ name: value }));
    result.push({
      columns: mergedColumns,
      enumValues,
      constraint_name: `${constraint_name}_${mergedColumns.join('_')}`
    });

    processedKeys.add(key);
  });

  return result;
}

function generateTablesAndEnums(db: Database): { tableList: Table[], enumList: Enum[], columnsWithEnum: { [key: string]: Enum } } {
  // Query to get all tables and their CREATE statements
  const tablesQuery = `
    SELECT name, sql FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
  `;

  const tables = db.prepare(tablesQuery).all();
  const tableList: Table[] = [];
  const enumList: Enum[] = [];
  const columnsWithEnum: { [key: string]: Enum } = {};

  tables.forEach((table: any) => {
    const tableName = table.name;
    tableList.push({
      name: tableName,
      schemaName: 'main',
      note: { value: '' },
    });

    const createTableSql = table.sql;
    if (!createTableSql) return;

    // Extract CHECK constraints from the CREATE TABLE statement
    // SQLite CHECK constraints can be in the format:
    // 1. Column level: "column_name TEXT CHECK(column_name IN ('value1', 'value2'))"
    // 2. Table level: "CHECK(column_name IN ('value1', 'value2'))"

    // Extract table-level CHECK constraints
    const tableCheckPattern = /CHECK\s*\(((?:[^()]+|\((?:[^()]+|\([^()]*\))*\))*)\)/gi;
    const tableCheckMatches = [...createTableSql.matchAll(tableCheckPattern)];

    tableCheckMatches.forEach((match, index) => {
      const checkDefinition = match[1];
      const constraintName = `check_${tableName}_${index}`;

      const enumValuesByColumns = getEnumValues(checkDefinition, constraintName);

      if (enumValuesByColumns.length > 0) {
        enumValuesByColumns.forEach(item => {
          const enumEle: Enum = {
            name: item.constraint_name,
            schemaName: 'main',
            values: item.enumValues,
          }

          enumList.push(enumEle);

          item.columns.forEach(col => {
            const key = `${tableName}.${col}`;
            columnsWithEnum[key] = enumEle;
          })
        });
      }
    });
  });

  return { tableList, enumList, columnsWithEnum };
}

function generateFieldsAndConstraints(tables: Table[], columnsWithEnum: { [key: string]: Enum }, db: Database): { fieldMap: FieldsDictionary; constraintMap: TableConstraintsDictionary } {
  const fieldMap: FieldsDictionary = {};
  const constraintMap: TableConstraintsDictionary = {};

  tables.forEach((table: any) => {
    const tableName = table.name;
    const columnsQuery = `PRAGMA table_info(${tableName});`;
    const columns = db.prepare(columnsQuery).all();

    fieldMap[`main.${tableName}`] = columns.map((row) => generateField(tableName, columnsWithEnum, row));

    const pkColumns = columns.filter((col: any) => col.pk === 1);

    if (pkColumns.length > 0) {
      const tableConstraint: TableConstraint = {};

      pkColumns.forEach((col: any) => {
        tableConstraint[col.name] = { pk: true };
      });

      constraintMap[`main.${tableName}`] = tableConstraint;
    }
  });

  return { fieldMap, constraintMap };
}

function generateIndexes(tables: Table[], db: Database): IndexesDictionary {
  const indexMap: IndexesDictionary = {};

  tables.forEach((table: any) => {
    const tableName = table.name;
    const indexesQuery = `PRAGMA index_list(${tableName});`;
    const indexes = db.prepare(indexesQuery).all();

    if (indexes.length === 0) return;

    indexMap[`main.${tableName}`] = [];

    indexes.forEach((index: any) => {
      const { name, unique } = index;

      // Skip auto-generated indexes for PRIMARY KEY
      if (name.startsWith('sqlite_autoindex_')) return;

      const indexInfoQuery = `PRAGMA index_info(${name});`;
      const indexColumns = db.prepare(indexInfoQuery).all();

      const columns: IndexColumn[] = indexColumns.map((col: any) => ({
        type: 'column',
        value: col.name,
      }));

      indexMap[`main.${tableName}`].push({
        name,
        type: 'btree',
        unique: unique === 1,
        columns,
      });
    });

    // Remove empty arrays
    if (indexMap[`main.${tableName}`].length === 0) {
      delete indexMap[`main.${tableName}`];
    }
  });

  return indexMap;
}

function generateForeignKeys(tables: Table[], db: Database): Ref[] {
  const foreignKeyList: Ref[] = [];

  tables.forEach((table: any) => {
    const tableName = table.name;
    const foreignKeysQuery = `PRAGMA foreign_key_list(${tableName});`;
    const foreignKeys = db.prepare(foreignKeysQuery).all();

    foreignKeys.forEach((fk: any) => {
      const {
        id,
        table: refTableName,
        from: foreignColumnName,
        to: refColumnName,
        on_update: onUpdate,
        on_delete: onDelete,
      } = fk;

      // Group foreign keys by id to handle composite foreign keys
      const existingRef = foreignKeyList.find(ref =>
        ref.name === `fk_${tableName}_${id}` &&
        ref.endpoints[0].tableName === tableName
      );

      if (existingRef) {
        // Add column to existing foreign key
        existingRef.endpoints[0].fieldNames.push(foreignColumnName);
        existingRef.endpoints[1].fieldNames.push(refColumnName);
      } else {
        // Create new foreign key
        const endpoint1 = {
          tableName,
          schemaName: 'main',
          fieldNames: [foreignColumnName],
          relation: '*' as const,
        };

        const endpoint2 = {
          tableName: refTableName,
          schemaName: 'main',
          fieldNames: [refColumnName],
          relation: '1' as const,
        };

        foreignKeyList.push({
          name: `fk_${tableName}_${id}`,
          endpoints: [endpoint1, endpoint2],
          onDelete: onDelete === 'NO ACTION' ? null : onDelete,
          onUpdate: onUpdate === 'NO ACTION' ? null : onUpdate,
        });
      }
    });
  });

  return foreignKeyList;
}

async function fetchSchemaJson(connection: string): Promise<DatabaseSchema> {
  const db = connectSQLite(connection);

  try {
    const {tableList, enumList, columnsWithEnum} = generateTablesAndEnums(db);
    const { fieldMap, constraintMap } = generateFieldsAndConstraints(tableList, columnsWithEnum, db);
    const indexMap = generateIndexes(tableList, db);
    const foreignKeyList = generateForeignKeys(tableList, db);

    return {
      tables: tableList,
      fields: fieldMap,
      refs: foreignKeyList,
      enums: enumList,
      indexes: indexMap,
      tableConstraints: constraintMap,
    };
  } finally {
    db.close();
  }
}

export {
  fetchSchemaJson,
};
