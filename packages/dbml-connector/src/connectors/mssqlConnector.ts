/* eslint-disable camelcase */
import sql from 'mssql';
import { buildSchemaQuery, parseConnectionString } from '../utils/parseSchema';
import {
  DatabaseSchema,
  DefaultInfo,
  DefaultType,
  Enum,
  EnumValue,
  Field,
  FieldsDictionary,
  IndexesDictionary,
  Ref,
  RefEndpoint,
  Table,
  TableConstraintsDictionary,
  EnumValuesDict,
} from './types';

// https://learn.microsoft.com/en-us/sql/t-sql/data-types/date-and-time-types?view=sql-server-ver15
const MSSQL_DATE_TYPES = [
  'date',
  'datetime',
  'datetime2',
  'smalldatetime',
  'datetimeoffset',
  'time',
];

const getValidatedClient = async (connection: string): Promise<sql.ConnectionPool> => {
  const pool = await sql.connect(connection);
  try {
    // Establish a connection pool
    // Validate if the connection is successful by making a simple query
    await pool.request().query('SELECT 1');

    // If successful, return the pool
    return pool;
  } catch (err) {
    // Ensure to close any open pool in case of failure
    if (pool.connected) {
      await pool.close();
    }
    if (err instanceof Error) {
      throw new Error(`SQL connection error: ${err.message}`);
    }

    throw err; // Rethrow error if you want the calling code to handle it
  }
};

const convertQueryBoolean = (val: string | null): boolean => val === 'YES';

const getFieldType = (data_type: string, character_maximum_length: number, numeric_precision: number, numeric_scale: number): string => {
  if (MSSQL_DATE_TYPES.includes(data_type)) {
    return data_type;
  }

  // timestamp is a synonym of rowversion and we cannot specify the precision for it
  // https://learn.microsoft.com/en-us/sql/t-sql/data-types/rowversion-transact-sql?view=sql-server-ver15
  if (data_type === 'timestamp') {
    return data_type;
  }

  // process numeric-based type
  if (data_type === 'bit') {
    return data_type;
  }
  // if precision != 0 => numeric-based column
  if (numeric_precision) {
    return numeric_scale
      ? `${data_type}(${numeric_precision},${numeric_scale})`
      : `${data_type}(${numeric_precision})`;
  }

  // process string-based type
  // ntext, text & image
  if (['ntext', 'text', 'image'].includes(data_type)) {
    return data_type;
  }

  // Column data type is varchar(max), nvarchar(max), varbinary(max), or xml
  if (character_maximum_length < 0) {
    return data_type === 'xml' ? data_type : `${data_type}(MAX)`;
  }

  // character_maximum_length is the lenght in bytes
  // nchar and nvarchar store Unicode characters, each character needs 2 bytes
  // so we have to divide it by 2 to get the correct maximum lenght in character.
  // ref: https://learn.microsoft.com/en-us/sql/t-sql/data-types/nchar-and-nvarchar-transact-sql?view=sql-server-ver15
  if (character_maximum_length > 0) {
    const maximum_length_in_character = (data_type === 'nchar' || data_type === 'nvarchar')
      ? character_maximum_length / 2
      : character_maximum_length;

    return `${data_type}(${maximum_length_in_character})`;
  }

  return data_type;
};

const getDbdefault = (data_type: string, column_default: string, default_type: DefaultType): DefaultInfo => {
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

const getEnumValues = (definition: string, constraint_name: string): EnumValuesDict[] => {
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
  if (!definition) return [];
  const values = definition.match(/\[([^\]]+)\]='([^']+)'/g); // Extracting the enum values when the definition contains ]='
  if (!values) return [];

  const colMap: { [key: string]: string[] } = {};
  values.forEach((value) => {
    const [columnName, enumValue] = value.split("]='");
    const cleanColumnName = columnName.slice(1); // Remove the leading '['
    const cleanEnumValue = enumValue.slice(0, -1); // Remove the trailing "'"
    if (!colMap[cleanColumnName]) {
      colMap[cleanColumnName] = [cleanEnumValue];
    } else {
      colMap[cleanColumnName].push(cleanEnumValue);
    }
  });

  const arraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  };

  // Please check the comments of the EnumValuesDict type in types.ts to understand the structure
  const result: EnumValuesDict[] = [];
  const processedKeys = new Set<string>();

  Object.keys(colMap).forEach((key) => {
    if (processedKeys.has(key)) return;

    let mergedColumns = [key];
    const values = colMap[key];

    Object.keys(colMap).forEach((innerKey) => {
      if (key !== innerKey && arraysEqual(values, colMap[innerKey])) {
        mergedColumns.push(innerKey);
        processedKeys.add(innerKey);
      }
    });
    const enumValues = values.map((value) => ({ name: value }));
    result.push({ columns: mergedColumns, enumValues, constraint_name: `${constraint_name}_${mergedColumns.join('_')}` });
    processedKeys.add(key);
  });

  return result;
};

const generateField = (row: Record<string, any>): Field => {
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
    type_name: getFieldType(data_type, character_maximum_length, numeric_precision, numeric_scale),
    schemaName: null,
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

const generateTablesFieldsAndEnums = async (client: sql.ConnectionPool, schemas: string[]): Promise<{
  tables: Table[],
  fields: FieldsDictionary,
  enums: Enum[],
}> => {
  const checkConstraintDefinitionDedup: { [key: string]: EnumValuesDict[] } = {};

  const fields: FieldsDictionary = {};
  const enums: Enum[] = [];
  const tablesAndFieldsSql = `
    WITH tables_and_fields AS (
      SELECT
        t.object_id AS table_id,
        s.name AS table_schema,
        t.name AS table_name,
        t.create_date as table_create_date,
        c.name AS column_name,
        c.column_id as column_id,
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
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.columns c ON t.object_id = c.object_id
        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        LEFT JOIN sys.extended_properties p ON p.major_id = t.object_id
          AND p.name = 'MS_Description'
          AND p.minor_id = 0 -- Ensure minor_id is 0 for table comments
        LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id
          AND ep.minor_id = c.column_id
          AND ep.name = 'MS_Description'
      WHERE
        t.type = 'U' -- User-defined tables
    ),
    constraints_with_nulls AS (
      SELECT
        tf.*,
        cc.name AS check_constraint_name,
        CASE
          WHEN cc.definition LIKE '%[' + tf.column_name + ']%=''%' THEN cc.definition
          ELSE NULL
        END AS check_constraint_definition
      FROM
        tables_and_fields AS tf
      LEFT JOIN sys.check_constraints cc
        ON cc.parent_object_id = OBJECT_ID(tf.table_schema + '.' + tf.table_name)
        AND cc.definition LIKE '%' + tf.column_name + '%' -- Ensure the constraint references the column
    ),
    constraints_with_row_number AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY table_schema, table_name, column_name
          ORDER BY
            CASE
              WHEN check_constraint_definition IS NOT NULL THEN 1
              ELSE 2
            END,
            check_constraint_name
        ) AS rn
      FROM
        constraints_with_nulls
    )
    SELECT
      table_schema,
      table_name,
      column_name,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      identity_increment,
      is_nullable,
      column_default,
      table_comment,
      column_comment,
      check_constraint_name,
      check_constraint_definition,
      CASE
        WHEN column_default LIKE '((%))' THEN 'number'
        WHEN column_default LIKE '(''%'')' THEN 'string'
        ELSE 'expression'
      END AS default_type
    FROM
      constraints_with_row_number
    WHERE
      rn = 1
      ${buildSchemaQuery('table_schema', schemas)}
    ORDER BY
      table_schema,
      table_create_date,
      table_id,
      column_id;
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
    const key = `${table_schema}.${table_name}`;

    if (!acc[key]) {
      acc[key] = {
        name: table_name,
        schemaName: table_schema,
        note: table_comment ? { value: table_comment } : { value: '' },
      };
    }

    if (!fields[key]) fields[key] = [];
    const field = generateField(row);

    if (check_constraint_definition && !checkConstraintDefinitionDedup[check_constraint_name]) {
      const enumValuesByColumns = getEnumValues(check_constraint_definition, check_constraint_name);
      enumValuesByColumns.forEach((item) => {
        enums.push({
          name: item.constraint_name,
          schemaName: table_schema,
          values: item.enumValues,
        });
      });
      checkConstraintDefinitionDedup[check_constraint_name] = enumValuesByColumns;
    }

    if (checkConstraintDefinitionDedup[check_constraint_name]) {
      const enumValuesByColumns = checkConstraintDefinitionDedup[check_constraint_name];
      const columnEnumValues = enumValuesByColumns.find((item) => item.columns.includes(field.name));
      if (columnEnumValues) {
        field.type = {
          type_name: columnEnumValues.constraint_name,
          schemaName: table_schema,
        };
      }
    }

    fields[key].push(field);

    return acc;
  }, {});

  return {
    tables: Object.values(tables),
    fields,
    enums,
  };
};

const generateRefs = async (client: sql.ConnectionPool, schemas: string[]): Promise<Ref[]> => {
  const refs: Ref[] = [];

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
      ${buildSchemaQuery('s.name', schemas)}
    ORDER BY
      s.name,
      t.name;
  `;

  const refsQueryResult = await client.query(refsListSql);

  const endpointsEqual = (ep1: RefEndpoint[], ep2: RefEndpoint[]): boolean => {
    if (ep1.length !== ep2.length) return false;
    return ep1.every((endpoint, index) => 
      endpoint.tableName === ep2[index].tableName &&
      endpoint.schemaName === ep2[index].schemaName &&
      endpoint.fieldNames.length === ep2[index].fieldNames.length &&
      endpoint.fieldNames.every((field, fieldIndex) => field === ep2[index].fieldNames[fieldIndex])
    );
  };

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

    const ep1: RefEndpoint = {
      tableName: table_name,
      schemaName: table_schema,
      fieldNames: column_names.split(','),
      relation: '*',
    };

    const ep2: RefEndpoint = {
      tableName: foreign_table_name,
      schemaName: foreign_table_schema,
      fieldNames: foreign_column_names.split(','),
      relation: '1',
    };

    const newRef = {
      name: fk_constraint_name,
      endpoints: [ep1, ep2],
      onDelete: on_delete === 'NO_ACTION' ? null : on_delete,
      onUpdate: on_update === 'NO_ACTION' ? null : on_update,
    };

    const isDuplicate = refs.some(ref => endpointsEqual(ref.endpoints, newRef.endpoints));

    if (!isDuplicate) {
      refs.push(newRef);
    }
  });

  return refs;
};

const generateIndexes = async (client: sql.ConnectionPool, schemas: string[]) => {
  const indexListSql = `
    WITH user_tables AS (
      SELECT
        TABLE_SCHEMA,
        TABLE_NAME
      FROM
        INFORMATION_SCHEMA.TABLES
      WHERE
        TABLE_TYPE = 'BASE TABLE'  -- Ensure we are only getting base tables
        AND TABLE_NAME NOT LIKE 'dt%'
        AND TABLE_NAME NOT LIKE 'syscs%'
        AND TABLE_NAME NOT LIKE 'sysss%'
        AND TABLE_NAME NOT LIKE 'sysrs%'
        AND TABLE_NAME NOT LIKE 'sysxlgc%'
    ),
    index_info AS (
      SELECT
        SCHEMA_NAME(t.schema_id) AS table_schema,  -- Add schema information
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
      ut.TABLE_SCHEMA AS table_schema,
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
      AND ut.TABLE_SCHEMA = ii.table_schema
    WHERE
      ii.columns IS NOT NULL
      ${buildSchemaQuery('ut.TABLE_SCHEMA', schemas)}
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

  const indexes = outOfLineConstraints.reduce((acc: IndexesDictionary, indexRow: Record<string, any>) => {
    const {
      table_schema,
      table_name,
      index_name,
      index_type,
      columns,
      expressions,
    } = indexRow;
    const indexColumns = columns.split(',').map((column: string) => {
      return {
        type: 'column',
        value: column.trim(),
      };
    });

    const indexExpressions = expressions ? expressions.split(',').map((expression: string) => {
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

    const key = `${table_schema}.${table_name}`;
    if (acc[key]) {
      acc[key].push(index);
    } else {
      acc[key] = [index];
    }

    return acc;
  }, {});

  const tableConstraints = inlineConstraints.reduce((acc: TableConstraintsDictionary, row: Record<string, any>) => {
    const {
      table_schema,
      table_name,
      columns,
      constraint_type,
    } = row;
    const key = `${table_schema}.${table_name}`;
    if (!acc[key]) acc[key] = {};

    const columnNames = columns.split(',').map((column: string) => column.trim());
    columnNames.forEach((columnName: string) => {
      if (!acc[key][columnName]) acc[key][columnName] = {};
      if (constraint_type === 'PRIMARY KEY') {
        acc[key][columnName].pk = true;
      }
      if (constraint_type === 'UNIQUE' && !acc[key][columnName].pk) {
        acc[key][columnName].unique = true;
      }
    });
    return acc;
  }, {});

  return {
    indexes,
    tableConstraints,
  };
};

const fetchSchemaJson = async (connection: string): Promise<DatabaseSchema> => {
  const { connectionString, schemas } = parseConnectionString(connection, 'odbc');
  const client = await getValidatedClient(connectionString);

  const tablesFieldsAndEnumsRes = generateTablesFieldsAndEnums(client, schemas);
  const indexesRes = generateIndexes(client, schemas);
  const refsRes = generateRefs(client, schemas);

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
  fetchSchemaJson
};
