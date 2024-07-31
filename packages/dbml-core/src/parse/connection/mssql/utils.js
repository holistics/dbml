/* eslint-disable camelcase */
import { Client } from 'pg';
import {
  Endpoint,
  // Enum,
  Field,
  Index,
  Table,
  Ref,
} from '../../ANTLR/ASTGeneration/AST';

const connectPg = async (connection) => {
  const client = new Client(connection);
  // bearer:disable javascript_lang_logger
  client.on('error', (err) => console.log('PG connection error:', err));

  await client.connect();
  return client;
};

const convertQueryBoolean = (val) => val === 'YES';

const getFieldType = (data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale) => {
  if (data_type === 'ARRAY') {
    return `${udt_name.slice(1, udt_name.length)}[]`;
  }
  if (character_maximum_length) {
    return `${udt_name}(${character_maximum_length})`;
  }
  if (numeric_precision && numeric_scale) {
    return `${udt_name}(${numeric_precision},${numeric_scale})`;
  }
  return udt_name;
};

const getDbdefault = (data_type, column_default, default_type) => {
  if (data_type === 'ARRAY') {
    const values = column_default.slice(6, -1).split(',').map((value) => {
      return value.split('::')[0];
    });
    return {
      type: default_type,
      value: `ARRAY[${values.join(', ')}]`,
    };
  }
  if (default_type === 'string') {
    const rawDefaultValues = column_default.split('::')[0];
    const isJson = data_type === 'json' || data_type === 'jsonb';
    const type = isJson ? 'expression' : 'string';
    return {
      type,
      value: rawDefaultValues.slice(1, -1),
    };
  }
  return {
    type: default_type,
    value: column_default,
  };
};

const generateRawField = (row) => {
  const {
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    udt_schema,
    udt_name,
    identity_increment,
    is_nullable,
    column_default,
    default_type,
    column_comment,
  } = row;

  const dbdefault = column_default && default_type !== 'increment' ? getDbdefault(data_type, column_default, default_type) : null;

  const fieldType = data_type === 'USER-DEFINED' ? {
    type_name: udt_name,
    schemaName: udt_schema,
  } : {
    type_name: getFieldType(data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale),
    schemaname: null,
  };

  return {
    name: column_name,
    type: fieldType,
    dbdefault,
    not_null: !convertQueryBoolean(is_nullable),
    increment: !!identity_increment || default_type === 'increment',
    note: column_comment ? { value: column_comment } : { value: '' },
  };
};

const generateRawTablesAndFields = async (client) => {
  const rawFields = {};
  const tablesAndFieldsSql = `
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
      c.default_object_id AS column_default,
      CASE
        WHEN c.default_object_id = 0 THEN NULL
        WHEN OBJECT_NAME(c.default_object_id) LIKE 'nextval%' THEN 'increment'
        WHEN c.default_object_id IS NOT NULL AND OBJECT_NAME(c.default_object_id) LIKE '''%' THEN 'string'
        WHEN c.default_object_id IS NOT NULL AND (SELECT definition FROM sys.sql_modules WHERE object_id = c.default_object_id) IN ('true', 'false') THEN 'boolean'
        WHEN c.default_object_id IS NOT NULL AND ISNUMERIC((SELECT definition FROM sys.sql_modules WHERE object_id = c.default_object_id)) = 1 THEN 'number'
        ELSE 'expression'
      END AS default_type,
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
      sys.extended_properties p ON p.major_id = t.object_id AND p.name = 'MS_Description'
    LEFT JOIN
      sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
    WHERE
      t.type = 'U'  -- User-defined tables
    ORDER BY
      s.name,
      t.name,
      c.column_id;
  `;

  const tablesAndFieldsResult = await client.query(tablesAndFieldsSql);
  const rawTables = tablesAndFieldsResult.rows.reduce((acc, row) => {
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
  refsQueryResult.rows.forEach((refRow) => {
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
      onDelete: on_delete,
      onUpdate: on_update,
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
  const { indexes, constraint } = indexListResult.rows.reduce((acc, row) => {
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
//   const enums = enumListResult.rows.reduce((acc, row) => {
//     const { schema_name, enum_type, enum_value } = row;

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

// const createEnums = (rawEnums) => {
//   return rawEnums.map((rawEnum) => {
//     const { name, schemaName, values } = rawEnum;
//     return new Enum({
//       name,
//       schemaName,
//       values,
//     });
//   });
// };

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
  const client = await connectPg(connection);
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
  client.end();

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
