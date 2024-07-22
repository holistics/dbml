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

const generateRawFields = (rows) => rows.map((columnRow) => {
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

  return {
    name: column_name,
    type: fieldType,
    dbdefault,
    not_null: !convertQueryBoolean(is_nullable),
    increment: !!identity_increment,
  };
});

const generateRawTables = async (client) => {
  const tableListSql = `
    SELECT *
    FROM pg_catalog.pg_tables
    WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'
  `;

  const tableListResult = await client.query(tableListSql);
  const rawTables = await Promise.all(tableListResult.rows.map(async (tableRow) => {
    const { schemaname, tablename } = tableRow;
    const columnListSql = `
      SELECT *
      FROM information_schema.columns
      WHERE table_schema = '${schemaname}' AND table_name   = '${tablename}';
    `;

    const columnListResult = await client.query(columnListSql);
    const rawFields = generateRawFields(columnListResult.rows);

    const rawTable = {
      name: tablename,
      schemaName: schemaname,
      rawFields,
    };

    return rawTable;
  }));
  return rawTables;
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

const createTables = (rawTables, fieldsConstraints) => {
  return rawTables.map((rawTable) => {
    const { name, schemaName, rawFields } = rawTable;
    const fields = createFields(rawFields, fieldsConstraints[name]);

    return new Table({
      name,
      schemaName,
      fields,
      indexes: [],
      enums: [],
    });
  });
};

const generateRawDb = async (connection) => {
  const client = await connectPg(connection);
  try {
    const rawTables = await generateRawTables(client);
    const { refs, tableContraints } = await generateConstraints(rawTables, client);
    const tables = createTables(rawTables, tableContraints);

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
