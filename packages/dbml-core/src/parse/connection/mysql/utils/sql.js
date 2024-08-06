import { createConnection } from 'mysql2/promise';
import { createEnums, createRefs, createTables } from './dbml';

/**
 * @param {string} connection
 * @returns {Promise<import('mysql2').Connection>} client
 */
async function connectMySQL (connection) {
  const client = await createConnection(connection);
  await client.connect();
  return client;
}

function getEnumName (tableName, columnName) {
  return `${tableName}_${columnName}_enum`;
}

function getGenerationExpression (extraType, generationExpression) {
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

function getDbDefault (columnDefault, defaultValueType) {
  if (columnDefault === null) {
    return null;
  }

  return { value: columnDefault, type: defaultValueType };
}

function getFieldType (tableName, columnName, columnType, columnDataType, columnExtra, generationExpression) {
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

function generateRawField (row) {
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
    type: { type_name: fieldType },
    dbdefault: fieldDefaultValue,
    notNull: !isNullable,
    increment: columnExtra === 'auto_increment',
    note: columnComment,
  };
}

// Do not get the index sub part since in DBML, it is impossible to create index on part of column.
function getIndexColumn (columnName, idxExpression, idxSubPart) {
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

async function generateRawTablesAndFields (client, schemaName = 'public') {
  const numberRegex = '^-?[0-9]+(.[0-9]+)?$';

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

  const queryResponse = await client.query(query, [numberRegex, schemaName]);
  const [rows] = queryResponse;

  const rawTableMap = {};
  const rawFieldMap = {};

  rows.forEach((row) => {
    const { tableName, tableComment } = row;
    if (!rawTableMap[tableName]) {
      rawTableMap[tableName] = {
        name: tableName,
        note: tableComment,
      };
    }

    if (!rawFieldMap[tableName]) {
      rawFieldMap[tableName] = [];
    }

    const field = generateRawField(row);
    rawFieldMap[tableName].push(field);
  });

  return {
    rawTableList: Object.values(rawTableMap),
    rawFieldMap,
  };
}

async function generateRawEnums (client, schemaName = 'public') {
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
  const [rows] = queryResponse;

  const rawEnumList = rows.map((row) => {
    const { tableName, columnName, rawValues } = row;

    // i.e. ('value1','value2')
    const valueList = rawValues
      .slice(1, -1)
      .split(',')
      .map((value) => ({ name: value.slice(1, -1) }));

    const enumName = getEnumName(tableName, columnName);

    return {
      name: enumName,
      values: valueList,
    };
  });

  return rawEnumList;
}

/**
 * Mysql is automatically create index for primary keys, foreign keys, unique constraint. -> Ignore
 */
async function generateRawIndexes (client, schemaName = 'public') {
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
  const [rows] = queryResponse;

  const rawIndexMap = rows.reduce((acc, row) => {
    const {
      tableName, idxName, idxType, isIdxUnique, columnName, idxExpression, idxSubPart,
    } = row;

    if (!acc[tableName]) {
      acc[tableName] = {};
    }

    if (!acc[tableName][idxName]) {
      // init first index
      acc[tableName][idxName] = {
        name: idxName,
        type: idxType,
        columns: [],
        unique: !!isIdxUnique,
      };
    }

    const currentIndex = acc[tableName][idxName];
    const column = getIndexColumn(columnName, idxExpression, idxSubPart);
    if (column) {
      currentIndex.columns.push(column);
    }

    return acc;
  }, {});

  return rawIndexMap;
}

async function generateRawPrimaryKeys (client, schemaName = 'public') {
  const query = `
    select
      tc.table_name as tableName,
      tc.constraint_name as constraintName,
      kcu.column_name as columnName
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
    on
      tc.constraint_schema = kcu.constraint_schema
      and tc.constraint_name = kcu.constraint_name
      and tc.table_name = kcu.table_name
    where
      tc.constraint_type = 'PRIMARY KEY' and tc.table_schema = ?
    order by tc.table_name, kcu.ordinal_position;
  `;

  const queryResponse = await client.query(query, [schemaName]);
  const [rows] = queryResponse;

  const rawPrimaryKeyMap = rows.reduce((acc, row) => {
    const { tableName, columnName, constraintName } = row;

    if (!acc[tableName]) {
      acc[tableName] = {
        name: constraintName,
        columns: [],
      };
    }

    acc[tableName].columns.push(columnName);

    return acc;
  }, {});

  return rawPrimaryKeyMap;
}

async function generateRawForeignKeys (client, schemaName = 'public') {
  const query = `
    select
      rc.constraint_name as constraintName,
      rc.table_name as foreignTableName,
      kcu.column_name as foreignColumnName,
      kcu.referenced_table_name as refTableName,
      kcu.referenced_column_name as refColumnName,
      rc.update_rule as onUpdate,
      rc.delete_rule as onDelete
    from information_schema.referential_constraints rc
    join information_schema.key_column_usage kcu
    on
      rc.constraint_name = kcu.constraint_name
      and rc.table_name = kcu.table_name
      and rc.constraint_schema = kcu.table_schema
    where rc.constraint_schema = ?
    order by
      rc.table_name, kcu.ordinal_position;
  `;

  const queryResponse = await client.query(query, [schemaName]);
  const [rows] = queryResponse;

  const rawForeignKeyMap = rows.reduce((acc, row) => {
    const {
      constraintName,
      onDelete,
      onUpdate,
      foreignTableName,
      foreignColumnName,
      refTableName,
      refColumnName,
    } = row;

    if (!acc[foreignTableName]) {
      acc[foreignTableName] = {};
    }

    if (!acc[foreignTableName][constraintName]) {
      acc[foreignTableName][constraintName] = {
        onDelete,
        onUpdate,
        foreignColumns: [],
        foreignTableName,
        refTableName,
        refColumns: [],
        name: constraintName,
      };
    }

    const currentForeignKey = acc[foreignTableName][constraintName];
    currentForeignKey.foreignColumns.push(foreignColumnName);
    currentForeignKey.refColumns.push(refColumnName);

    return acc;
  }, {});

  return rawForeignKeyMap;
}

async function generateRawUniqueConstraints (client, schemaName = 'public') {
  const query = `
    select
      tc.constraint_name as constraintName,
      tc.table_name as tableName,
      kcu.column_name as columnName
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
    on
      tc.constraint_name = kcu.constraint_name
      and tc.table_name = kcu.table_name
      and tc.table_schema = kcu.table_schema
    where
      tc.constraint_type = 'UNIQUE' and tc.table_schema = ?
    order by
      tc.table_name, kcu.ordinal_position;
  `;

  const queryResponse = await client.query(query, [schemaName]);
  const [rows] = queryResponse;

  const rawUniqueConstraintMap = rows.reduce((acc, row) => {
    const { constraintName, tableName, columnName } = row;

    if (!acc[tableName]) {
      acc[tableName] = {};
    }

    if (!acc[tableName][constraintName]) {
      acc[tableName][constraintName] = {
        name: constraintName,
        columns: [],
      };
    }

    acc[tableName][constraintName].columns.push(columnName);

    return acc;
  }, {});

  return rawUniqueConstraintMap;
}

export async function generateRawDb (connection) {
  let client = null;

  try {
    client = await connectMySQL(connection);

    // In MySQL, a schema is equal database
    const { database: schemaName } = client.config;

    const result = await Promise.all([
      generateRawTablesAndFields(client, schemaName),
      generateRawEnums(client, schemaName),
      generateRawIndexes(client, schemaName),
      generateRawPrimaryKeys(client, schemaName),
      generateRawUniqueConstraints(client, schemaName),
      generateRawForeignKeys(client, schemaName),
    ]);

    const [
      { rawTableList, rawFieldMap },
      rawEnumList,
      rawIndexMap,
      rawPrimaryKeyMap,
      rawUniqueConstraintMap,
      rawForeignKeyMap,
    ] = result;

    const enumList = createEnums(rawEnumList);
    const tableList = createTables(
      rawTableList,
      rawFieldMap,
      rawPrimaryKeyMap,
      rawUniqueConstraintMap,
      rawIndexMap,
    );
    const refList = createRefs(rawForeignKeyMap);

    return {
      tables: tableList,
      refs: refList,
      enums: enumList,
    };
  } catch (error) {
    throw new Error(error);
  } finally {
    client?.end();
  }
}
