import { createConnection } from 'mysql2/promise';

/**
 *
 * @param {string} connection
 * @returns {Promise<import('mysql2').Connection>} client
 */
async function connectMySQL (connection) {
  const client = await createConnection(connection);
  await client.connect();
  // TODO: handle connection error
  return client;
}

/**
 * @param {string} extraType
 * @param {string} generationExpression
 * @returns {string}
 */
function getGenerationExpression (extraType, generationExpression) {
  if (!extraType) return '';

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

/**
 * @param {string} columnDataType
 * @param {string | null} columnDefault
 * @param {boolean} isNullable
 */
function getDbDefault (columnDefault, isNullable) {
  if (columnDefault === null) {
    if (!isNullable) { return null; }

    return { value: null };
  }

  return { value: columnDefault };
}

// TODO: recheck enum value
function generateRawField (row) {
  const {
    columnName,
    columnDefault,
    columnIsNullable,
    columnType,
    columnComment,
    columnExtra,
    generationExpression,
  } = row;

  let fieldType = columnType;
  const fieldGenerationExpression = getGenerationExpression(columnExtra, generationExpression);
  if (fieldGenerationExpression) {
    fieldType = `${fieldType} ${fieldGenerationExpression}`;
  }

  const isNullable = columnIsNullable === 'YES';
  const fieldDefaultValue = getDbDefault(columnDefault, isNullable);

  // field object
  return {
    name: columnName,
    type: fieldType,
    default: fieldDefaultValue,
    notNull: !isNullable,
    increment: !!(columnExtra === 'auto_increment'),
    note: columnComment,
  };
}

function getIndexColumn (columnName, idxSubPart, idxExpression) {
  if (idxExpression) {
    return idxExpression;
  }

  if (idxSubPart && columnName) {
    return `${columnName}(${idxSubPart})`;
  }

  return '';
}

/**
 * @param {import('mysql2/promise').Connection} client
 * @param {string} schemaName
 */
async function generateRawTablesAndFields (client, schemaName = 'public') {
  const query = `
    select
      t.table_name as tableName,
      t.table_comment as tableComment,
      c.column_name as columnName,
      c.column_default as columnDefault,
      c.is_nullable as columnIsNullable,
      c.data_type as columnDataType,
      c.character_maximum_length,
      c.character_octet_length,
      c.numeric_precision,
      c.numeric_scale,
      c.character_set_name,
      c.collation_name,
      c.column_type as columnType,
      c.extra as columnExtra,
      c.column_comment as columnComment,
      c.generation_expression as generationExpression
    from information_schema.tables t
    join information_schema.columns c on t.table_name = c.table_name
    where
      t.table_schema = ? and t.table_type = 'BASE TABLE'
    order by
      t.table_name, c.ordinal_position;
  `;

  const queryResponse = await client.query(query, [schemaName]);
  const [rows] = queryResponse;

  const rawFieldMap = {};
  const rawTableMap = rows.reduce((acc, row) => {
    const { tableName, tableComment } = row;

    if (!acc[tableName]) {
      acc[tableName] = {
        comment: tableComment,
      };
    }

    if (!rawFieldMap[tableName]) rawFieldMap[tableName] = [];
    const field = generateRawField(row);
    rawFieldMap[tableName].push(field);
    return acc;
  }, {});

  return {
    rawTableMap,
    rawFieldMap,
  };
}

/**
 * @param {import('mysql2/promise').Connection} client
 * @param {string} schemaName
 */
async function generateRawEnums (client, schemaName = 'public') {
  const query = `
    select
      t.table_name as tableName,
      c.column_name as columnName,
      TRIM(LEADING 'enum' FROM c.column_type) AS rawValues
    from information_schema.tables t
    join information_schema.columns c on t.table_name = c.table_name
    where
      t.table_schema = ? and t.table_type = 'BASE TABLE' and c.data_type = 'enum'
    order by
      t.table_name, c.ordinal_position;
  `;

  const queryResponse = await client.query(query, [schemaName]);
  const [rows] = queryResponse;

  const rawEnumMap = rows.reduce((acc, row) => {
    const { tableName, columnName, rawValues } = row;

    // ('value1','value2')
    const valueList = rawValues.slice(1, -1).split(',');

    const enumName = `${tableName}_${columnName}`;
    if (!acc[enumName]) {
      acc[enumName] = {
        name: enumName,
        value: valueList,
      };
    }
    return acc;
  }, {});

  return rawEnumMap;
}

/**
 * @param {import('mysql2/promise').Connection} client
 * @param {string} schemaName
 */
async function generateRawIndexes (client, schemaName = 'public') {
  /**
   * Mysql is automatically create index for primary keys, foreign keys, unique constraint. -> Ignore
   *
   */
  const query = `
    with
      foreign_keys as (
        select col.constraint_name
        from information_schema.tables t
        join information_schema.key_column_usage col on t.table_name = col.table_name
        where
          t.table_schema = ? and t.table_type = 'BASE TABLE'
          and col.referenced_table_name is not null
          and col.referenced_column_name is not null
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
      st.expression as idxExpression
    from information_schema.tables t
    join information_schema.statistics st on t.table_name = st.table_name
    where
      st.table_schema = ?
      and t.table_type = 'BASE TABLE'
      and st.index_name <> 'PRIMARY'
      and st.index_name not in (select * from foreign_keys)
      and st.index_type in ('BTREE', 'HASH')
    group by st.table_name, st.non_unique, st.index_name, st.column_name, st.sub_part, st.index_type, st.expression;
  `;

  const queryResponse = await client.query(query, [schemaName, schemaName]);
  const [rows] = queryResponse;

  const rawIndexMap = rows.reduce((acc, row) => {
    const {
      tableName, idxName, idxType, isIdxUnique, columnName, idxSubPart, idxExpression,
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

    // init column value and push to index
    const currentIndex = acc[tableName][idxName];
    const column = getIndexColumn(columnName, idxSubPart, idxExpression);
    if (column) {
      currentIndex.columns.push(column);
    }

    return acc;
  }, {});

  return rawIndexMap;
}

/**
 * @param {import('mysql2/promise').Connection} client
 * @param {string} schemaName
 */
async function generateRawPrimaryKeys (client, schemaName = 'public') {
  const query = `
    select
      tc.table_name as tableName,
      kcu.column_name as columnName
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_name = kcu.table_name
    where
      tc.constraint_type = 'PRIMARY KEY' and tc.table_schema = ?
    order by tc.table_name, kcu.ordinal_position;
  `;

  const queryResponse = await client.query(query, [schemaName]);
  const [rows] = queryResponse;

  const rawPrimaryKeyMap = rows.reduce((acc, row) => {
    const { tableName, columnName } = row;

    if (!acc[tableName]) {
      acc[tableName] = {
        columns: [columnName],
      };

      return acc;
    }

    acc[tableName].columns.push(columnName);
    return acc;
  }, {});

  return rawPrimaryKeyMap;
}

/**
 * @param {import('mysql2/promise').Connection} client
 * @param {string} schemaName
 */
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
        refTableName,
        refColumns: [],
      };
    }

    const currentForeignKey = acc[foreignTableName][constraintName];
    currentForeignKey.foreignColumns.push(foreignColumnName);
    currentForeignKey.refColumns.push(refColumnName);

    return acc;
  }, {});

  return rawForeignKeyMap;
}

/**
 * @param {import('mysql2/promise').Connection} client
 * @param {string} schemaName
 */
async function generateRawUniqueConstraints (client, schemaName = 'public') {
  // const query = ``;

  // const queryResponse = await client.query(query, [schemaName]);
  // const [rows] = queryResponse;

  // const uniqueConstraintMap = rows.reduce((acc, row) => {
  //   return acc;
  // }, {});

  // return uniqueConstraintMap;
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
      generateRawForeignKeys(client, schemaName),
      generateRawUniqueConstraints(client, schemaName),
    ]);

    // const { rawTableMap, rawFieldMap } = result[0];

    // console.table(rawTableMap);

    // Object.keys(rawFieldMap).forEach((key) => {
    //   console.log(key);
    //   console.table(rawFieldMap[key]);
    // });

    // console.table(result[1]);
    // console.log(JSON.stringify(result[2]));
    console.log(JSON.stringify(result[4]));
  } catch (error) {
    throw new Error(error);
  } finally {
    client?.end();
  }

  return { tables: {}, refs: {} };
}
