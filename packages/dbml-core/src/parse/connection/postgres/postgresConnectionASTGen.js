/* eslint-disable camelcase */
import { Client } from 'pg';
import {
  Endpoint,
  Enum,
  Field,
  Index,
  Table,
  Ref,
} from '../../ANTLR/ASTGeneration/AST';

const connectPg = async (connection) => {
  if (!connection.host) throw new Error('Host is required');

  const client = new Client(connection);
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
  };
};

const generateRawTablesAndFields = async (client) => {
  const rawFields = {};
  const tablesAndFieldsSql = `
    SELECT
      t.table_schema,
      t.table_name,
      c.column_name,
      c.data_type,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      c.udt_schema,
      c.udt_name,
      c.identity_increment,
      c.is_nullable,
      c.column_default,
      CASE
        WHEN c.column_default IS NULL THEN NULL
        WHEN c.column_default LIKE 'nextval(%' THEN 'increment'
        WHEN c.column_default LIKE '''%' THEN 'string'
        WHEN c.column_default = 'true' OR c.column_default = 'false' THEN 'boolean'
        WHEN c.column_default ~ '^-?[0-9]+(.[0-9]+)?$' THEN 'number'
        ELSE 'expression'
      END AS default_type
    FROM
      information_schema.columns c
    JOIN
      information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE
      t.table_type = 'BASE TABLE'
      AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY
      t.table_schema,
      t.table_name,
      c.ordinal_position
    ;
  `;

  const tablesAndFieldsResult = await client.query(tablesAndFieldsSql);
  const rawTables = tablesAndFieldsResult.rows.reduce((acc, row) => {
    const { table_schema, table_name } = row;

    if (!acc[table_name]) {
      acc[table_name] = {
        name: table_name,
        schemaName: table_schema,
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

  const constraintListSql = `
    SELECT
      tc.table_schema,
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_type
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema NOT IN ('pg_catalog', 'information_schema');
  `;

  const constraints = await client.query(constraintListSql);
  constraints.rows.forEach((constraintRow) => {
    const {
      table_schema, constraint_name, table_name, column_name, foreign_table_schema, foreign_table_name, foreign_column_name, constraint_type,
    } = constraintRow;

    switch (constraint_type) {
      case 'FOREIGN KEY': {
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
          onDelete: '',
          onUpdate: '',
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
        break;
      }
      default:
        break;
    }
  });

  return refs;
};

const generateRawIndexes = async (client) => {
  // const tableConstraints = {};
  const indexListSql = `
    WITH user_tables AS (
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'sql_%'
    ),
    index_info AS (
      SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        am.amname AS index_type,
        array_to_string(array_agg(a.attname ORDER BY x.n), ', ') AS columns,
        pg_get_expr(ix.indexprs, ix.indrelid) AS expressions,
        CASE
          WHEN ix.indisprimary THEN 'PRIMARY KEY'
          WHEN ix.indisunique THEN 'UNIQUE'
          ELSE NULL
        END AS constraint_type
      FROM
        pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        JOIN pg_am am ON i.relam = am.oid
        LEFT JOIN generate_subscripts(ix.indkey, 1) AS x(n) ON a.attnum = ix.indkey[x.n]
      WHERE
        t.relkind = 'r'
        AND t.relname NOT LIKE 'pg_%'
        AND t.relname NOT LIKE 'sql_%'
      GROUP BY
        t.relname, i.relname, ix.indisunique, ix.indisprimary, am.amname, ix.indexprs, ix.indrelid
    )
    SELECT
      ut.tablename AS table_name,
      ii.index_name,
      ii.is_unique,
      ii.is_primary,
      ii.index_type,
      ii.columns,
      ii.expressions,
      ii.constraint_type  -- Added constraint type
    FROM
      user_tables ut
    LEFT JOIN
      index_info ii ON ut.tablename = ii.table_name
    WHERE ii.columns IS NOT NULL
    ORDER BY
      ut.tablename,
      ii.constraint_type,
      ii.index_name
    ;
  `;
  const indexListResult = await client.query(indexListSql);
  const { indexes, constraint } = indexListResult.rows.reduce((acc, row) => {
    const { constraint_type } = row;
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

const generateRawEnums = async (client) => {
  const enumListSql = `
    SELECT
      n.nspname AS schema_name,
      t.typname AS enum_type,
      e.enumlabel AS enum_value,
      e.enumsortorder AS sort_order
    FROM
      pg_enum e
    JOIN
      pg_type t ON e.enumtypid = t.oid
    JOIN
      pg_namespace n ON t.typnamespace = n.oid
    ORDER BY
      schema_name,
      enum_type,
      sort_order;
    ;
  `;
  const enumListResult = await client.query(enumListSql);
  const enums = enumListResult.rows.reduce((acc, row) => {
    const { schema_name, enum_type, enum_value } = row;

    if (!acc[enum_type]) {
      acc[enum_type] = {
        name: enum_type,
        schemaName: schema_name,
        values: [],
      };
    }
    acc[enum_type].values.push({
      name: enum_value,
    });
    return acc;
  }, {});

  return Object.values(enums);
};

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
    const { name, schemaName } = rawTable;
    const constraints = tableConstraints[name] || {};
    const fields = createFields(rawFields[name], constraints);
    const indexes = createIndexes(rawIndexes[name] || []);

    return new Table({
      name,
      schemaName,
      fields,
      indexes,
      enums: [],
    });
  });
};

const generateRawDb = async (connection) => {
  const client = await connectPg(connection);
  try {
    const data1 = generateRawTablesAndFields(client);
    const data2 = generateRawIndexes(client);
    const data3 = generateRefs(client);
    const data4 = generateRawEnums(client);

    const result = await Promise.all([data1, data2, data3, data4]);
    const { rawTables, rawFields } = result[0];
    const { rawIndexes, tableConstraints } = result[1];
    const refs = result[2];
    const rawEnums = result[3];

    const tables = createTables(rawTables, rawFields, rawIndexes, tableConstraints);
    const enums = createEnums(rawEnums);

    return {
      tables,
      refs,
      enums,
    };
  } catch (err) {
    throw new Error(err);
  } finally {
    client.end();
  }
};

export default class PostgresConnectionASTGen {
  constructor () {
    this.data = {
      schemas: [],
      tables: [],
      refs: [],
      enums: [],
      tableGroups: [],
      aliases: [],
      project: {},
    };
  }

  async fetch (connection) {
    const { tables, refs, enums } = await generateRawDb(connection);

    this.data.tables = tables;
    this.data.refs = refs;
    this.data.enums = enums;

    return this.data;
  }
}
