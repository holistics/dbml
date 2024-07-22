/* eslint-disable camelcase */
import { Client } from 'pg';
import { flatten } from 'lodash';
import { Endpoint, Enum, Field, Index, Table, Ref } from '../AST';

const connectPg = async (connection) => {
  if (!connection.host) throw new Error('Host is required');

  const client = new Client(connection);
  client.on('error', (err) => console.log('PG connection error:', err));

  await client.connect();
  return client;
};

const convertQueryBoolean = (val) => val === 'YES';

const generateRawField = (row) => {
  const {
    column_name,
    data_type,
    // character_maximum_length,
    // numeric_precision,
    // numeric_scale,
    udt_schema,
    udt_name,
    identity_increment,
    is_nullable,
    // column_default,
    // default_type,
  } = row;

  // if (column_default) console.log(`type: ${default_type}, value: ${column_default}`);
  const dbdefault = null;
  /* if (column_default) {
    const [rawDefaultValue, rawDefaultType] = column_default.split('::');
    dbdefault = { // improve this later
      type: 'string', // always string for now,
      value: rawDefaultValue,
    };
  } */

  const fieldType = data_type === 'USER-DEFINED' ? { // TODO: add enum first
    type_name: `"${udt_name}.${udt_schema}"`, // udt_name,
    schemaName: null, // udt_schema,
  } : {
    type_name: data_type,
    schemaname: null,
  };

  return {
    name: column_name,
    type: fieldType,
    dbdefault,
    not_null: !convertQueryBoolean(is_nullable),
    increment: !!identity_increment,
  };
};

const generateRawTables = async (client) => {
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
        WHEN c.column_default IS NULL THEN 'null'
        WHEN c.column_default LIKE 'nextval(%' THEN 'expression'
        WHEN c.column_default = 'CURRENT_TIMESTAMP' THEN 'expression'
        WHEN c.column_default = 'true' OR c.column_default = 'false' THEN 'boolean'
        WHEN c.column_default ~ '^-?[0-9]+(.[0-9]+)?$' THEN 'number'
        ELSE 'string_or_expression'
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
    const {
      table_schema, table_name,
    } = row;
    if (!acc[table_name]) {
      acc[table_name] = {
        name: table_name,
        schemaName: table_schema,
        rawFields: [],
      };
    }
    const field = generateRawField(row);
    acc[table_name].rawFields.push(field);
    return acc; // Add this line to return the accumulator
  }, {});
  return Object.values(rawTables);
};

const generateTableContraints = (constraints) => {
  const registeredFK = [];
  const refs = [];
  const fieldConstraints = {};
  constraints.rows.forEach((constraintRow) => {
    const {
      table_schema, constraint_name, table_name, column_name, foreign_table_schema, foreign_table_name, foreign_column_name, constraint_type,
    } = constraintRow;

    switch (constraint_type) {
      case 'PRIMARY KEY': {
        if (fieldConstraints[column_name]) {
          fieldConstraints[column_name].pk = true;
        } else {
          fieldConstraints[column_name] = { pk: true };
        }
        break;
      }
      case 'UNIQUE': {
        if (fieldConstraints[column_name]) {
          fieldConstraints[column_name].unique = true;
        } else {
          fieldConstraints[column_name] = { unique: true };
        }
        break;
      }
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

  return {
    refs,
    fieldConstraints,
  };
};

const generateConstraints = async (tables, client) => {
  const tableContraints = {};
  const tableRefs = await Promise.all(tables.map(async (table) => {
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
      WHERE tc.table_schema='${table.schemaName}' AND tc.table_name='${table.name}';
    `;

    const constraintListResult = await client.query(constraintListSql);
    const { refs, fieldConstraints } = generateTableContraints(constraintListResult, table.fields);
    tableContraints[table.name] = fieldConstraints;
    return refs;
  }));
  return {
    refs: flatten(tableRefs),
    tableContraints,
  };
};

const generateTableIndexes = async (client) => {
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
        pg_get_expr(ix.indexprs, ix.indrelid) AS expressions
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
      ii.expressions
    FROM
      user_tables ut
    LEFT JOIN
      index_info ii ON ut.tablename = ii.table_name
    WHERE ii.columns IS NOT NULL
    ;
  `;
  const indexListResult = await client.query(indexListSql);

  return indexListResult.rows.reduce((acc, indexRow) => {
    const {
      table_name, index_name, is_unique, is_primary, index_type, columns, expressions,
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
      unique: is_unique,
      primary: is_primary,
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

const createTables = (rawTables, tableIndexes, fieldsConstraints) => {
  return rawTables.map((rawTable) => {
    const { name, schemaName, rawFields } = rawTable;
    const fields = createFields(rawFields, fieldsConstraints[name]);
    const indexes = createIndexes(tableIndexes[name] || []);

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
    const rawTables = await generateRawTables(client);
    const { refs, tableContraints } = await generateConstraints(rawTables, client);
    const tableIndexes = await generateTableIndexes(client);
    console.log(tableIndexes);
    const tables = createTables(rawTables, tableIndexes, tableContraints);

    return {
      tables,
      refs,
    };
  } catch (err) {
    throw new Error(err);
  } finally {
    client.end();
  }
};

export default class PostgresDBASTGen {
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
    const { tables, refs } = await generateRawDb(connection);

    this.data.tables = tables;
    this.data.refs = refs;

    return this.data;
  }
}
