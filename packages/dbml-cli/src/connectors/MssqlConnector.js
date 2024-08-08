/* eslint-disable camelcase */
import sql from 'mssql';

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
  if (character_maximum_length && character_maximum_length > 0 && default_type === 'string') {
    return `${data_type}(${character_maximum_length})`;
  }
  return data_type;
};

const getDbdefault = (data_type, column_default, default_type) => {
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

const getEnumValues = (definition) => {
  // Use the example below to understand the regex:
  // ([quantity]>(0))
  // ([unit_price]>(0))
  // ([status]='cancelled' OR [status]='delivered' OR [status]='shipped' OR [status]='processing' OR [status]='pending')
  // ([total_amount]>(0))
  // ([price]>(0))
  // ([stock_quantity]>=(0))
  // ([age_start]<=[age_end])
  // ([age_start]<=[age_end])
  // ([gender]='Other' OR [gender]='Female' OR [gender]='Male')
  // ([date_of_birth]<=dateadd(year,(-13),getdate()))
  // ([email] like '%_@_%._%')
  if (!definition) return null;
  const values = definition.match(/\[([^\]]+)\]='([^']+)'/g); // Extracting the enum values when the definition contains ]='
  if (!values) return null;

  const enumValues = values.map((value) => {
    const enumValue = value.split("]='")[1];
    return { name: enumValue.slice(0, -1) };
  });
  return enumValues;
};

const generateField = (row) => {
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

  const dbdefault = column_default && default_type !== 'increment' ? getDbdefault(data_type, column_default, default_type) : null;

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

const generateTablesFieldsAndEnums = async (client) => {
  const fields = {};
  const enums = [];
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
  const tables = tablesAndFieldsResult.recordset.reduce((acc, row) => {
    const {
      table_schema,
      table_name,
      table_comment,
      check_constraint_name,
      check_constraint_definition,
    } = row;

    if (!acc[table_name]) {
      acc[table_name] = {
        name: table_name,
        schemaName: table_schema,
        note: table_comment ? { value: table_comment } : { value: '' },
      };
    }

    const enumValues = getEnumValues(check_constraint_definition);
    if (enumValues) {
      enums.push({
        name: check_constraint_name,
        schemaName: table_schema,
        values: enumValues,
      });
    }

    if (!fields[table_name]) fields[table_name] = [];
    const field = generateField(row);
    if (enumValues) {
      field.type = {
        type_name: check_constraint_name,
        schemaName: table_schema,
      };
    }
    fields[table_name].push(field);

    return acc;
  }, {});

  return {
    tables: Object.values(tables),
    fields,
    enums,
  };
};

const generateRefs = async (client) => {
  const refs = [];

  const refsListSql = `
    SELECT
      s.name AS table_schema,
      t.name AS table_name,
      fk.name AS fk_constraint_name,
      STUFF((
        SELECT ',' + c1.name
        FROM sys.foreign_key_columns AS fkc
        JOIN sys.columns AS c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
        WHERE fkc.constraint_object_id = fk.object_id
        FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS column_names,
      s2.name AS foreign_table_schema,
      t2.name AS foreign_table_name,
      STUFF((
        SELECT ',' + c2.name
        FROM sys.foreign_key_columns AS fkc
        JOIN sys.columns AS c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
        WHERE fkc.constraint_object_id = fk.object_id
        FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS foreign_column_names,
      fk.type_desc AS constraint_type,
      fk.delete_referential_action_desc AS on_delete,
      fk.update_referential_action_desc AS on_update
    FROM sys.foreign_keys AS fk
    JOIN sys.tables AS t ON fk.parent_object_id = t.object_id
    JOIN sys.schemas AS s ON t.schema_id = s.schema_id
    JOIN sys.tables AS t2 ON fk.referenced_object_id = t2.object_id
    JOIN sys.schemas AS s2 ON t2.schema_id = s2.schema_id
    WHERE s.name NOT IN ('sys', 'information_schema')
    ORDER BY
      s.name,
      t.name;
  `;

  const refsQueryResult = await client.query(refsListSql);
  refsQueryResult.recordset.forEach((refRow) => {
    const {
      table_schema,
      fk_constraint_name,
      table_name,
      column_names,
      foreign_table_schema,
      foreign_table_name,
      foreign_column_names,
      on_delete,
      on_update,
    } = refRow;

    const ep1 = {
      tableName: table_name,
      schemaName: table_schema,
      fieldNames: column_names.split(','),
      relation: '*',
    };

    const ep2 = {
      tableName: foreign_table_name,
      schemaName: foreign_table_schema,
      fieldNames: foreign_column_names.split(','),
      relation: '1',
    };

    refs.push({
      name: fk_constraint_name,
      endpoints: [ep1, ep2],
      onDelete: on_delete === 'NO_ACTION' ? null : on_delete,
      onUpdate: on_update === 'NO_ACTION' ? null : on_update,
    });
  });

  return refs;
};

const generateIndexes = async (client) => {
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
  const { outOfLineConstraints, inlineConstraints } = indexListResult.recordset.reduce((acc, row) => {
    const { constraint_type, columns } = row;

    if (columns === 'null' || columns.trim() === '') return acc;
    if (constraint_type === 'PRIMARY KEY' || constraint_type === 'UNIQUE') {
      acc.inlineConstraints.push(row);
    } else {
      acc.outOfLineConstraints.push(row);
    }
    return acc;
  }, { outOfLineConstraints: [], inlineConstraints: [] });

  const indexes = outOfLineConstraints.reduce((acc, indexRow) => {
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

  const tableConstraints = inlineConstraints.reduce((acc, row) => {
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
    indexes,
    tableConstraints,
  };
};

const fetchSchemaJson = async (connection) => {
  const client = await connect(connection);
  if (!client) throw new Error('Failed to connect to the database');

  const tablesFieldsAndEnumsRes = generateTablesFieldsAndEnums(client);
  const indexesRes = generateIndexes(client);
  const refsRes = generateRefs(client);

  const res = await Promise.all([
    tablesFieldsAndEnumsRes,
    indexesRes,
    refsRes,
  ]);
  client.close();

  const { tables, fields, enums } = res[0];
  const { indexes, tableConstraints } = res[1];
  const refs = res[2];

  return {
    tables,
    fields,
    enums,
    refs,
    indexes,
    tableConstraints,
  };
};

export {
  fetchSchemaJson,
};
