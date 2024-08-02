/* eslint-disable camelcase */
import sql from 'mssql';

import {
  Endpoint,
  Enum,
  Field,
  Index,
  Table,
  Ref,
} from '../../ANTLR/ASTGeneration/AST';

const MSSQL_DATE_TYPES = [
  'date',
  'datetime',
  'datetime2',
  'smalldatetime',
  'datetimeoffset',
  'time',
];

const connect = async (connection) => {
  const options = connection.split(';').reduce((acc, option) => {
    const [key, value] = option.split('=');
    acc[key] = value;
    return acc;
  }, {});
  const [host, port] = options['Data Source'].split(',');

  const config = {
    user: options['User ID'],
    password: options.Password,
    server: host,
    database: options['Initial Catalog'],
    options: {
      encrypt: options.Encrypt === 'True',
      trustServerCertificate: options['Trust Server Certificate'] === 'True',
      port: port || 1433,
    },
  };
  console.log(config);

  try {
    // Connect to the database using the connection string
    const client = await sql.connect(config);
    return client;
  } catch (err) {
    console.log('MSSQL connection error:', err);
    return null;
  }
};

const convertQueryBoolean = (val) => val === 'YES';

const getFieldType = (data_type, default_type, character_maximum_length, numeric_precision, numeric_scale) => {
  if (MSSQL_DATE_TYPES.includes(data_type)) {
    return data_type;
  }
  if (data_type === 'bit') {
    return data_type;
  }
  if (numeric_precision && numeric_scale && default_type === 'number') {
    return `${data_type}(${numeric_precision},${numeric_scale})`;
  }
  if (character_maximum_length && default_type === 'string') {
    return `${data_type}(${character_maximum_length})`;
  }
  return data_type;
};

const getDbdefault = (column_default, default_type) => {
  // The regex below is used to extract the value from the default value
  // \( and \) are used to escape parentheses
  // [^()]+ is used to match any character except parentheses
  // Example: (1) => 1, ('hello') => hello, getdate()-(1) => getdate()-1
  const value = column_default.slice(1, -1).replace(/\(([^()]+)\)/g, '$1');

  return {
    type: default_type,
    value: default_type === 'string' ? value.slice(1, -1) : value, // Remove the quotes for string values
  };
};

const generateRawField = (row) => {
  const {
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    identity_increment,
    is_nullable,
    column_default,
    default_type,
    column_comment,
  } = row;

  const dbdefault = column_default && default_type !== 'increment' ? getDbdefault(column_default, default_type) : null;

  const fieldType = {
    type_name: getFieldType(data_type, default_type, character_maximum_length, numeric_precision, numeric_scale),
    schemaname: null,
  };

  return {
    name: column_name,
    type: fieldType,
    dbdefault,
    not_null: !convertQueryBoolean(is_nullable),
    increment: !!identity_increment,
    note: column_comment ? { value: column_comment } : { value: '' },
  };
};

const generateRawTablesAndFields = async (client) => {
  const rawFields = {};
  const tablesAndFieldsSql = `
    WITH tables_and_fields AS (
        SELECT
            s.name AS table_schema,
            t.name AS table_name,
            c.name AS column_name,
            ty.name AS data_type,
            c.max_length AS character_maximum_length,
            c.precision AS numeric_precision,
            c.scale AS numeric_scale,
            c.is_identity AS identity_increment,
            CASE
                WHEN c.is_nullable = 1 THEN 'YES'
                ELSE 'NO'
            END AS is_nullable,
            CASE
                WHEN c.default_object_id = 0 THEN NULL
                ELSE OBJECT_DEFINITION(c.default_object_id)
            END AS column_default,
            -- Fetching table comments
            p.value AS table_comment,
            ep.value AS column_comment
        FROM
            sys.tables t
        JOIN
            sys.schemas s ON t.schema_id = s.schema_id
        JOIN
            sys.columns c ON t.object_id = c.object_id
        JOIN
            sys.types ty ON c.user_type_id = ty.user_type_id
        LEFT JOIN
            sys.extended_properties p ON p.major_id = t.object_id
                AND p.name = 'MS_Description'
                AND p.minor_id = 0 -- Ensure minor_id is 0 for table comments
        LEFT JOIN
            sys.extended_properties ep ON ep.major_id = c.object_id
                AND ep.minor_id = c.column_id
                AND ep.name = 'MS_Description'
        WHERE
            t.type = 'U' -- User-defined tables
    )
    SELECT
        tf.table_schema,
        tf.table_name,
        tf.column_name,
        tf.data_type,
        tf.character_maximum_length,
        tf.numeric_precision,
        tf.numeric_scale,
        tf.identity_increment,
        tf.is_nullable,
        tf.column_default,
        tf.table_comment,
        tf.column_comment,
        cc.name AS check_constraint_name, -- Adding CHECK constraint name
        cc.definition AS check_constraint_definition, -- Adding CHECK constraint definition
        CASE
            WHEN tf.column_default LIKE '((%))' THEN 'number'
            WHEN tf.column_default LIKE '(''%'')' THEN 'string'
            ELSE 'expression'
        END AS default_type
    FROM
        tables_and_fields AS tf
    LEFT JOIN
        sys.check_constraints cc ON cc.parent_object_id = OBJECT_ID(tf.table_schema + '.' + tf.table_name)
        AND cc.definition LIKE '%' + tf.column_name + '%' -- Ensure the constraint references the column
    ORDER BY
        tf.table_schema,
        tf.table_name,
        tf.column_name;
  `;

  const tablesAndFieldsResult = await client.query(tablesAndFieldsSql);
  const rawTables = tablesAndFieldsResult.recordset.reduce((acc, row) => {
    const { table_schema, table_name, table_comment } = row;

    if (!acc[table_name]) {
      acc[table_name] = {
        name: table_name,
        schemaName: table_schema,
        note: table_comment ? { value: table_comment } : { value: '' },
      };
    }

    if (!rawFields[table_name]) rawFields[table_name] = [];
    const field = generateRawField(row);
    rawFields[table_name].push(field);

    return acc;
  }, {});

  return {
    rawTables: Object.values(rawTables),
    rawFields,
  };
};

const generateRefs = async (client) => {
  const registeredFK = [];
  const refs = [];

  const refsListSql = `
    SELECT
      fk.name AS constraint_name,
      OBJECT_SCHEMA_NAME(fk.parent_object_id) AS table_schema,
      OBJECT_NAME(fk.parent_object_id) AS table_name,
      c.name AS column_name,
      OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS foreign_table_schema,
      OBJECT_NAME(fk.referenced_object_id) AS foreign_table_name,
      ccu.name AS foreign_column_name,
      fk.type_desc AS constraint_type,
      fk.delete_referential_action_desc AS on_delete,
      fk.update_referential_action_desc AS on_update
    FROM sys.foreign_keys AS fk
    JOIN sys.foreign_key_columns AS fkc
      ON fk.object_id = fkc.constraint_object_id
    JOIN sys.columns AS c
      ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
    JOIN sys.columns AS ccu
      ON fkc.referenced_object_id = ccu.object_id AND fkc.referenced_column_id = ccu.column_id
    WHERE fk.is_ms_shipped = 0;  -- Exclude system-defined constraints
  `;

  const refsQueryResult = await client.query(refsListSql);
  refsQueryResult.recordset.forEach((refRow) => {
    const {
      table_schema,
      constraint_name,
      table_name,
      column_name,
      foreign_table_schema,
      foreign_table_name,
      foreign_column_name,
      on_delete,
      on_update,
    } = refRow;

    const ep1 = new Endpoint({
      tableName: table_name,
      schemaName: table_schema,
      fieldNames: [column_name],
      relation: '*',
    });

    const ep2 = new Endpoint({
      tableName: foreign_table_name,
      schemaName: foreign_table_schema,
      fieldNames: [foreign_column_name],
      relation: '1',
    });

    const ref = new Ref({
      name: constraint_name,
      endpoints: [ep1, ep2],
      onDelete: on_delete === 'NO_ACTION' ? null : on_delete,
      onUpdate: on_update === 'NO_ACTION' ? null : on_update,
    });

    if (!registeredFK.some(((fk) => fk.table_schema === table_schema
      && fk.table_name === table_name
      && fk.column_name === column_name
      && fk.foreign_table_schema === foreign_table_schema
      && fk.foreign_table_name === foreign_table_name
      && fk.foreign_column_name === foreign_column_name
    ))) {
      refs.push(ref.toJSON());
      registeredFK.push({
        table_schema, table_name, column_name, foreign_table_schema, foreign_table_name, foreign_column_name,
      });
    }
  });

  return refs;
};

const generateRawIndexes = async (client) => {
  // const tableConstraints = {};
  const indexListSql = `
    WITH user_tables AS (
      SELECT
        TABLE_NAME
      FROM
        INFORMATION_SCHEMA.TABLES
      WHERE
        TABLE_SCHEMA = 'dbo'
        AND TABLE_TYPE = 'BASE TABLE'  -- Ensure we are only getting base tables
        AND TABLE_NAME NOT LIKE 'dt%'
        AND TABLE_NAME NOT LIKE 'syscs%'
        AND TABLE_NAME NOT LIKE 'sysss%'
        AND TABLE_NAME NOT LIKE 'sysrs%'
        AND TABLE_NAME NOT LIKE 'sysxlgc%'
    ),
    index_info AS (
      SELECT
        OBJECT_NAME(i.object_id) AS table_name,
        i.name AS index_name,
        i.is_unique,
        CASE
          WHEN i.type = 1 THEN 1
          ELSE 0
        END AS is_primary,
        i.type_desc AS index_type,
        STUFF((
          SELECT
            ', ' + c.name
          FROM
            sys.index_columns ic
            JOIN sys.columns c ON ic.column_id = c.column_id AND ic.object_id = c.object_id
          WHERE
            ic.index_id = i.index_id
            AND ic.object_id = i.object_id
            AND OBJECT_NAME(ic.object_id) IN (SELECT TABLE_NAME FROM user_tables)  -- Filter for user tables
          ORDER BY
            ic.key_ordinal
          FOR XML PATH('')
        ), 1, 2, '') AS columns,
        CASE
          WHEN i.type = 1 THEN 'PRIMARY KEY'
          WHEN i.is_unique = 1 THEN 'UNIQUE'
          ELSE NULL
        END AS constraint_type
      FROM
        sys.indexes i
        JOIN sys.tables t ON i.object_id = t.object_id
      WHERE
        t.is_ms_shipped = 0
        AND i.type <> 0
    )
    SELECT
      ut.TABLE_NAME AS table_name,
      ii.index_name,
      ii.is_unique,
      ii.is_primary,
      ii.index_type,
      ii.columns,
      ii.constraint_type
    FROM
      user_tables ut
    LEFT JOIN
      index_info ii ON ut.TABLE_NAME = ii.table_name
    WHERE
      ii.columns IS NOT NULL
    ORDER BY
      ut.TABLE_NAME,
      ii.constraint_type,
      ii.index_name;
  `;
  const indexListResult = await client.query(indexListSql);
  const { indexes, constraint } = indexListResult.recordset.reduce((acc, row) => {
    const { constraint_type, columns } = row;

    if (columns === 'null' || columns.trim() === '') return acc;
    if (constraint_type === 'PRIMARY KEY' || constraint_type === 'UNIQUE') {
      acc.constraint.push(row);
    } else {
      acc.indexes.push(row);
    }
    return acc;
  }, { indexes: [], constraint: [] });

  const rawIndexes = indexes.reduce((acc, indexRow) => {
    const {
      table_name,
      index_name,
      index_type,
      columns,
      expressions,
    } = indexRow;
    const indexColumns = columns.split(',').map((column) => {
      return {
        type: 'column',
        value: column.trim(),
      };
    });

    const indexExpressions = expressions ? expressions.split(',').map((expression) => {
      return {
        type: 'expression',
        value: expression,
      };
    }) : [];

    const index = {
      name: index_name,
      type: index_type,
      columns: [
        ...indexColumns,
        ...indexExpressions,
      ],
    };

    if (acc[table_name]) {
      acc[table_name].push(index);
    } else {
      acc[table_name] = [index];
    }

    return acc;
  }, {});

  const tableConstraints = constraint.reduce((acc, row) => {
    const {
      table_name,
      columns,
      constraint_type,
    } = row;
    if (!acc[table_name]) acc[table_name] = {};

    const columnNames = columns.split(',').map((column) => column.trim());
    columnNames.forEach((columnName) => {
      if (!acc[table_name][columnName]) acc[table_name][columnName] = {};
      if (constraint_type === 'PRIMARY KEY') {
        acc[table_name][columnName].pk = true;
      }
      if (constraint_type === 'UNIQUE' && !acc[table_name][columnName].pk) {
        acc[table_name][columnName].unique = true;
      }
    });
    return acc;
  }, {});

  return {
    rawIndexes,
    tableConstraints,
  };
};

// const generateRawEnums = async (client) => {
//   const enumListSql = `
//     WITH EnumValues AS (
//         SELECT
//             SCHEMA_NAME(t.schema_id) AS schema_name,
//             t.name AS table_name,
//             c.name AS column_name,
//             cc.definition AS check_constraint_definition
//         FROM
//             sys.tables t
//         JOIN
//             sys.columns c ON t.object_id = c.object_id
//         LEFT JOIN
//             sys.check_constraints cc ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
//         WHERE
//             cc.definition IS NOT NULL
//     )
//     SELECT
//         schema_name,
//         table_name,
//         column_name,
//         -- Extracting the enum values from the CHECK constraint definition
//         TRIM(SUBSTRING(
//             cc.check_constraint_definition,
//             CHARINDEX('(', cc.check_constraint_definition) + 1,
//             CHARINDEX(')', cc.check_constraint_definition) - CHARINDEX('(', cc.check_constraint_definition) - 1
//         )) AS enum_values
//     FROM
//         EnumValues cc
//     WHERE
//         cc.check_constraint_definition LIKE '%IN (%'  -- Check for inline constraints using IN
//         OR cc.check_constraint_definition LIKE '%=%'   -- Check for inline constraints using =
//     ORDER BY
//         schema_name,
//         table_name,
//         column_name;
//   `;
//   const enumListResult = await client.query(enumListSql);
//   const enums = enumListResult.recordset.reduce((acc, row) => {
//     const { schema_name, table_name, column_name, enum_values } = row;

//     if (!acc[enum_type]) {
//       acc[enum_type] = {
//         name: enum_type,
//         schemaName: schema_name,
//         values: [],
//       };
//     }
//     acc[enum_type].values.push({
//       name: enum_value,
//     });
//     return acc;
//   }, {});

//   return Object.values(enums);
// };

const createEnums = (rawEnums) => {
  return rawEnums.map((rawEnum) => {
    const { name, schemaName, values } = rawEnum;
    return new Enum({
      name,
      schemaName,
      values,
    });
  });
};

const createFields = (rawFields, fieldsConstraints) => {
  return rawFields.map((field) => {
    const constraints = fieldsConstraints[field.name] || {};
    const f = new Field({
      name: field.name,
      type: field.type,
      dbdefault: field.dbdefault,
      not_null: field.not_null,
      increment: field.increment,
      pk: constraints.pk,
      unique: constraints.unique,
      note: field.note,
    });
    return f;
  });
};

const createIndexes = (rawIndexes) => {
  return rawIndexes.map((rawIndex) => {
    const {
      name, unique, primary, type, columns,
    } = rawIndex;
    const index = new Index({
      name,
      unique,
      pk: primary,
      type,
      columns,
    });
    return index;
  });
};

const createTables = (rawTables, rawFields, rawIndexes, tableConstraints) => {
  return rawTables.map((rawTable) => {
    const { name, schemaName, note } = rawTable;
    const constraints = tableConstraints[name] || {};
    const fields = createFields(rawFields[name], constraints);
    const indexes = createIndexes(rawIndexes[name] || []);

    return new Table({
      name,
      schemaName,
      fields,
      indexes,
      note,
    });
  });
};

const generateRawDb = async (connection) => {
  const client = await connect(connection);
  if (!client) throw new Error('Failed to connect to the database');

  const tablesAndFieldsRes = generateRawTablesAndFields(client);
  const rawIndexesRes = generateRawIndexes(client);
  const refsRes = generateRefs(client);
  // const rawEnumsRes = generateRawEnums(client);

  const res = await Promise.all([
    tablesAndFieldsRes,
    rawIndexesRes,
    refsRes,
    // rawEnumsRes,
  ]);
  client.close();

  const { rawTables, rawFields } = res[0];
  const { rawIndexes, tableConstraints } = res[1];
  const refs = res[2];
  // const rawEnums = res[3];

  try {
    const tables = createTables(rawTables, rawFields, rawIndexes, tableConstraints);
    // const enums = createEnums(rawEnums);

    return {
      tables,
      refs,
      // enums,
    };
  } catch (err) {
    throw new Error(err);
  }
};

export {
  generateRawDb,
};
