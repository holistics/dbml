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

const generateFields = (rows) => rows.map((columnRow) => {
  const {
    column_name,
    data_type, udt_schema, udt_name,
    is_nullable, identity_increment,
  } = columnRow;

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

  return new Field({
    name: column_name,
    type: fieldType,
    dbdefault,
    not_null: !convertQueryBoolean(is_nullable),
    increment: !!identity_increment,
  });
});

const generateTables = async (client) => {
  const tableListSql = `
    SELECT *
    FROM pg_catalog.pg_tables
    WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'
  `;

  const tableListResult = await client.query(tableListSql);
  const tables = await Promise.all(tableListResult.rows.map(async (tableRow) => {
    const { schemaname, tablename } = tableRow;
    const columnListSql = `
      SELECT *
      FROM information_schema.columns
      WHERE table_schema = '${schemaname}' AND table_name   = '${tablename}';
    `;

    const columnListResult = await client.query(columnListSql);
    const fields = generateFields(columnListResult.rows);

    const table = new Table({
      name: tablename,
      schemaName: schemaname,
      fields,
    });

    return table;
  }));
  return tables;
};

const generateTableRefs = (constraints, fields) => {
  const registeredFK = [];
  const refs = [];
  constraints.rows.forEach((constraintRow) => {
    const {
      table_schema, constraint_name, table_name, column_name, foreign_table_schema, foreign_table_name, foreign_column_name, constraint_type,
    } = constraintRow;

    switch (constraint_type) {
      case 'PRIMARY KEY': {
        const pkField = fields.find((f) => f.name === column_name);
        pkField.pk = true;
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

  return refs;
};

const generateRefs = async (tables, client) => {
  const refs = await Promise.all(tables.map(async (table) => {
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
    return generateTableRefs(constraintListResult, table.fields);
  }));
  return flatten(refs);
};

const generateRawDb = async (connection) => {
  const client = await connectPg(connection);

  const tables = await generateTables(client);
  const refs = await generateRefs(tables, client);
  await client.end();

  return {
    tables,
    refs,
  };
};

export default class PostgresDBASTGen {
  constructor (connection) {
    this.connection = connection;
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

  async fetch () {
    const { tables, refs } = await generateRawDb(this.connection);

    this.data.tables = tables;
    this.data.refs = refs;

    return this.data;
  }
}
