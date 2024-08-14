import { createConnection, Connection } from 'mysql2/promise';
import { flatten } from 'lodash';
import { DefaultInfo, DatabaseSchema, DefaultType, Field, IndexColumn, FieldsDictionary, Table, Enum, IndexesDictionary, TableConstraintsDictionary, Index, TableConstraint, Ref } from './types';

const NUMBER_REGEX = '^-?[0-9]+(.[0-9]+)?$';

async function connectMySQL (connection: string): Promise<Connection> {
  const client = await createConnection(connection);
  try {
    await client.connect();
    await client.query('SELECT 1');

    return client;
  } catch (error) {
    await client.end();
    if (error instanceof Error) {
      throw new Error(`MySQL connection error: ${error.message}`);
    }

    throw error;
  }
}

function getEnumName (tableName: string, columnName: string): string {
  return `${tableName}_${columnName}_enum`;
}

function getGenerationExpression (extraType: string, generationExpression: string) {
  if (extraType === 'VIRTUAL GENERATED') {
    return `GENERATED ALWAYS AS (${generationExpression}) VIRTUAL`;
  }

  if (extraType === 'STORED GENERATED') {
    return `GENERATED ALWAYS AS (${generationExpression}) STORED`;
  }

  // for timestamp data type
  if (extraType.includes('on update CURRENT_TIMESTAMP')) {
    return 'on update CURRENT_TIMESTAMP';
  }

  // others
  return '';
}

function getDbDefault (columnDefault: string, defaultValueType: DefaultType): DefaultInfo | null {
  if (columnDefault === null) {
    return null;
  }

  return { value: columnDefault, type: defaultValueType };
}

function getFieldType (tableName: string, columnName: string, columnType: string, columnDataType: string, columnExtra: string, generationExpression: string) {
  if (columnDataType === 'enum') {
    // enum must have static value -> no need to check the generation expression
    return getEnumName(tableName, columnName);
  }

  const fieldGenerationExpression = getGenerationExpression(columnExtra, generationExpression);
  if (fieldGenerationExpression) {
    return `${columnType} ${fieldGenerationExpression}`;
  }

  return columnType;
}

function generateField (row: Record<string, any>): Field {
  const {
    tableName,
    columnName,
    columnDefault,
    defaultValueType,
    columnIsNullable,
    columnType,
    columnDataType,
    columnComment,
    columnExtra,
    generationExpression,
  } = row;

  const fieldType = getFieldType(
    tableName,
    columnName,
    columnType,
    columnDataType,
    columnExtra,
    generationExpression,
  );

  const fieldDefaultValue = getDbDefault(columnDefault, defaultValueType);

  const isNullable = columnIsNullable === 'YES';

  return {
    name: columnName,
    type: { type_name: fieldType, schemaName: null },
    dbdefault: fieldDefaultValue,
    not_null: !isNullable,
    increment: columnExtra === 'auto_increment',
    note: { value: columnComment || '' },
  };
}

// Do not get the index sub part since in DBML, it is impossible to create index on part of column.
function getIndexColumn (columnName: string, idxExpression: string, idxSubPart: any): IndexColumn | null {
  if (idxExpression) {
    return { value: idxExpression, type: 'expression' };
  }

  if (idxSubPart) {
    return { value: `${columnName}(${idxSubPart})`, type: 'expression' };
  }

  if (columnName) {
    return { value: columnName, type: 'column' };
  }

  return null;
}

async function generateTablesAndFields (client: Connection, schemaName: string): Promise<{
  tableList: Table[];
  fieldMap: FieldsDictionary;
}> {
  const query = `
    select
      t.table_name as tableName,
      t.table_comment as tableComment,
      c.column_name as columnName,
      c.column_default as columnDefault,
      case
        when c.column_default is null then 'boolean'
        when c.data_type = 'enum' then 'string'
        when c.column_default regexp ? then 'number'
        when c.extra like '%DEFAULT_GENERATED%' then 'expression'
        else 'string'
      end as defaultValueType,
      c.is_nullable as columnIsNullable,
      c.data_type as columnDataType,
      c.column_type as columnType,
      c.extra as columnExtra,
      c.column_comment as columnComment,
      c.generation_expression as generationExpression
    from information_schema.tables t
    join information_schema.columns c
    on t.table_schema = c.table_schema and t.table_name = c.table_name
    where
      t.table_schema = ? and t.table_type = 'BASE TABLE'
    order by
      t.table_name, c.ordinal_position;
  `;

  const queryResponse = await client.query(query, [NUMBER_REGEX, schemaName]);
  const rows: any = queryResponse[0];

  const tableMap: Record<string, any> = {};
  const fieldMap: FieldsDictionary = {};

  rows.forEach((row: Record<string, any>) => {
    const { tableName, tableComment } = row;
    const key = tableName;

    if (!tableMap[key]) {
      tableMap[key] = {
        name: tableName,
        note: { value: tableComment || '' },
      };
    }

    if (!fieldMap[key]) {
      fieldMap[key] = [];
    }

    const field = generateField(row);
    fieldMap[key].push(field);
  });

  return {
    tableList: Object.values(tableMap),
    fieldMap,
  };
}

async function generateEnums (client: Connection, schemaName: string): Promise<Enum[]> {
  const query = `
    select
      t.table_name as tableName,
      c.column_name as columnName,
      TRIM(LEADING 'enum' FROM c.column_type) AS rawValues
    from information_schema.tables t
    join information_schema.columns c
    on t.table_schema = c.table_schema and t.table_name = c.table_name
    where
      t.table_schema = ? and t.table_type = 'BASE TABLE' and c.data_type = 'enum'
    order by
      t.table_name, c.ordinal_position;
  `;

  const queryResponse = await client.query(query, [schemaName]);
  const rows: any = queryResponse[0];

  const enumList = rows.map((row: Record<string, any>) => {
    const { tableName, columnName, rawValues } = row;

    // i.e. ('value1','value2')
    const valueList = rawValues
      .slice(1, -1)
      .split(',')
      .map((value: string) => ({ name: value.slice(1, -1) }));

    const enumName = getEnumName(tableName, columnName);

    return {
      name: enumName,
      values: valueList,
    };
  });

  return enumList;
}

/**
 * Mysql is automatically create index for primary keys, foreign keys, unique constraint. -> Ignore
 */
async function generateIndexes (client: Connection, schemaName: string): Promise<IndexesDictionary> {
  const query = `
    with
      pk_fk_uniques as (
        select constraint_name, table_name
        from information_schema.table_constraints
        where table_schema = ?
      )
    select
      st.table_name as tableName,
      case
        when st.non_unique = 0 then true
        else false
        end as isIdxUnique,
      st.index_name as idxName,
      st.column_name as columnName,
      st.sub_part as idxSubPart,
      st.index_type as idxType,
      replace(st.expression, '\`', '') as idxExpression
    from information_schema.statistics st
    where
      st.table_schema = ?
      and st.index_name not in (
        select constraint_name
        from pk_fk_uniques pfu
        where pfu.table_name = st.table_name
      )
      and st.index_type in ('BTREE', 'HASH')
    group by
      st.table_name, st.non_unique, st.index_name, st.column_name, st.sub_part, st.index_type, st.expression
    order by st.index_name;
  `;

  const queryResponse = await client.query(query, [schemaName, schemaName]);
  const rows: any = queryResponse[0];

  const tableIndexMap = rows.reduce((acc: Record<string, Record<string, Index>>, row: Record<string, any>) => {
    const {
      tableName, idxName, idxType, isIdxUnique, columnName, idxExpression, idxSubPart,
    } = row;
    const key = tableName;

    if (!acc[key]) {
      acc[key] = {};
    }

    if (!acc[key][idxName]) {
      // init first index
      acc[key][idxName] = {
        name: idxName,
        type: idxType,
        columns: [],
        unique: !!isIdxUnique,
      };
    }

    const currentIndex = acc[key][idxName];
    const column = getIndexColumn(columnName, idxExpression, idxSubPart);
    if (column) {
      currentIndex.columns.push(column);
    }

    return acc;
  }, {});

  const indexMap: IndexesDictionary = {};
  Object.keys(tableIndexMap).forEach((tableName) => {
    indexMap[tableName] = flatten(Object.values(tableIndexMap[tableName]));
  });

  return indexMap;
}

async function generatePrimaryAndUniqueConstraint (client: Connection, schemaName: string) {
  const query = `
    select
      tc.table_name as tableName,
      tc.constraint_name as constraintName,
      group_concat(kcu.column_name order by kcu.ordinal_position separator ',') as columnNames,
      count(kcu.column_name) as columnCount,
      tc.constraint_type as constraintType
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
    on
      tc.constraint_schema = kcu.constraint_schema
      and tc.constraint_name = kcu.constraint_name
      and tc.table_name = kcu.table_name
    where
      (tc.constraint_type = 'PRIMARY KEY' or tc.constraint_type = 'UNIQUE')
      and tc.table_schema = ?
    group by tc.table_name, tc.constraint_name, tc.constraint_type
    order by tc.table_name, tc.constraint_name;
  `;

  const queryResponse = await client.query(query, [schemaName]);
  const rows: any = queryResponse[0];

  const inlineConstraintList = rows.filter((constraint: Record<string, any>) => constraint.columnCount === 1);
  const outOfConstraintList = rows.filter((constraint: Record<string, any>) => constraint.columnCount > 1);

  const compositeTableConstraintMap = outOfConstraintList.reduce((acc: any, row: Record<string, any>) => {
    const {
      tableName, constraintName, columnNames, constraintType,
    } = row;

    const key = tableName;
    if (!acc[key]) {
      acc[key] = {};
    }

    if (!acc[key][constraintName]) {
      acc[key][constraintName] = {
        name: constraintName,
      };
    }

    if (constraintType === 'PRIMARY KEY') {
      acc[key][constraintName].primary = true;
    }

    if (constraintType === 'UNIQUE') {
      acc[key][constraintName].unique = true;
    }

    const columnList = columnNames
      .split(',')
      .map((col: string) => ({ type: 'column', value: col }));
    acc[key][constraintName].columns = columnList;

    return acc;
  }, {});

  const compositeConstraintMap: any = {};
  Object.keys(compositeTableConstraintMap).forEach((tableName) => {
    compositeConstraintMap[tableName] = flatten(Object.values(compositeTableConstraintMap[tableName]));
  });

  const constraintMap = inlineConstraintList.reduce((acc: any, row: Record<string, any>) => {
    const { tableName, columnNames, constraintType } = row;

    const key = tableName;
    if (!acc[key]) {
      acc[key] = {};
    }

    const columnList = columnNames.split(',');

    columnList.forEach((columnName: string) => {
      if (!acc[key][columnName]) {
        acc[key][columnName] = {};
      }

      if (constraintType === 'PRIMARY KEY') {
        acc[key][columnName].pk = true;
      }

      if (constraintType === 'UNIQUE' && !acc[key][columnName].pk) {
        acc[key][columnName].unique = true;
      }
    });
    return acc;
  }, {});

  return { compositeConstraintMap, constraintMap };
}

async function generateForeignKeys (client: Connection, schemaName: string): Promise<Ref[]> {
  const query = `
    select
      rc.constraint_name as constraintName,
      rc.table_name as foreignTableName,
      group_concat(kcu.column_name order by kcu.ordinal_position separator ',') as foreignColumnNames,
      kcu.referenced_table_name as refTableName,
      group_concat(kcu.referenced_column_name order by kcu.ordinal_position separator ',') as refColumnNames,
      rc.update_rule as onUpdate,
      rc.delete_rule as onDelete
    from information_schema.referential_constraints rc
    join information_schema.key_column_usage kcu
    on
      rc.constraint_name = kcu.constraint_name
      and rc.table_name = kcu.table_name
      and rc.constraint_schema = kcu.table_schema
    where rc.constraint_schema = ?
    group by
      rc.constraint_name,
      rc.table_name,
      kcu.referenced_table_name,
      rc.update_rule,
      rc.delete_rule
    order by
      rc.table_name;
  `;

  const queryResponse = await client.query(query, [schemaName]);
  const rows: any = queryResponse[0];

  const foreignKeyList = rows.map((row: Record<string, any>) => {
    const {
      constraintName,
      onDelete,
      onUpdate,
      foreignTableName,
      foreignColumnNames,
      refTableName,
      refColumnNames,
    } = row;

    const endpoint1 = {
      tableName: foreignTableName,
      fieldNames: foreignColumnNames.split(','),
      relation: '*',
    };

    const endpoint2 = {
      tableName: refTableName,
      fieldNames: refColumnNames.split(','),
      relation: '1',
    };

    return {
      name: constraintName,
      endpoints: [endpoint1, endpoint2],
      onDelete: onDelete === 'NO ACTION' ? null : onDelete,
      onUpdate: onUpdate === 'NO ACTION' ? null : onUpdate,
    };
  });

  return foreignKeyList;
}

function combineIndexAndCompositeConstraint (userDefinedIndexMap: any, compositeConstraintMap: any) {
  const indexMap = Object.assign(userDefinedIndexMap, {});

  Object.keys(compositeConstraintMap).forEach((tableName) => {
    const compositeConstraint = compositeConstraintMap[tableName];
    if (!indexMap[tableName]) {
      indexMap[tableName] = compositeConstraint;
      return;
    }

    indexMap[tableName].push(...compositeConstraint);
  });

  return indexMap;
}

async function fetchSchemaJson (connection: string): Promise<DatabaseSchema> {
  const client = await connectMySQL(connection);

  // In MySQL, a schema is equal database
  const { database: schemaName } = client.config;
  if (!schemaName) {
    throw new Error('Cannot get schema name from the connection');
  }

  const result = await Promise.all([
    generateTablesAndFields(client, schemaName),
    generateEnums(client, schemaName),
    generateIndexes(client, schemaName),
    generatePrimaryAndUniqueConstraint(client, schemaName),
    generateForeignKeys(client, schemaName),
  ]);
  client.end();

  const [
    { tableList, fieldMap },
    enumList,
    rawIndexMap,
    { constraintMap, compositeConstraintMap },
    foreignKeyList,
  ] = result;

  // combine normal index and composite key
  const indexMap = combineIndexAndCompositeConstraint(rawIndexMap, compositeConstraintMap);

  return {
    tables: tableList,
    fields: fieldMap,
    refs: foreignKeyList,
    enums: enumList,
    indexes: indexMap,
    tableConstraints: constraintMap,
  };
}

export {
  fetchSchemaJson,
};
