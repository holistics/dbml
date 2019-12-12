import _ from 'lodash';
import Database from '../../src/model_structure/database';
import jsonDb from './single_schema.json';
import { DEFAULT_SCHEMA_NAME } from '../../src/model_structure/config';

describe('@dbml/core - model_structure', () => {
  let database;

  beforeAll(() => {
    database = new Database(jsonDb);
  });

  describe('general_schema', () => {
    describe('nested_structure', () => {
      test('database - contains all properties', () => {
        expect(database.id).toBeDefined();
        expect(database.schemas).toBeDefined();
        expect(database.refs).toBeDefined();
      });

      test('database - contains all schemas', () => {
        expect(database.schemas).toHaveLength(1);

        expect(database.schemas.map((schema => schema.name))).toEqual(expect.arrayContaining(['public']));
      });

      test('database - contains all refs', () => {
        expect(database.refs).toHaveLength(6);

        const refs = database.refs.map((ref) => ({
          name: ref.name,
          onDelete: ref.onDelete,
          onUpdate: ref.onUpdate,
          endpoints: ref.endpoints.map((endpoint) => ({
            schemaName: endpoint.field.table.schema.name,
            tableName: endpoint.field.table.name,
            fieldName: endpoint.field.name,
            relation: endpoint.relation,
          })),
        }));

        expect(refs).toEqual(expect.arrayContaining([
          expect.objectContaining({
            onDelete: 'cascade',
            onUpdate: 'no action',
            endpoints: expect.arrayContaining([
              {
                schemaName: 'public',
                tableName: 'users',
                fieldName: 'country_code',
                relation: '*',
              },
              {
                schemaName: 'public',
                tableName: 'countries',
                fieldName: 'code',
                relation: '1',
              },
            ]),
          }),
        ]));
      });

      test('all schemas - contains all properties', () => {
        database.schemas.forEach((schema) => {
          expect(schema.id).toBeDefined();
          expect(schema.name).toBeDefined();
          expect(schema.database).toBeDefined();
          expect(schema.tables).toBeDefined();
          expect(schema.enums).toBeDefined();
          expect(schema.tableGroups).toBeDefined();

          expect(schema).toHaveProperty('alias');
          expect(schema).toHaveProperty('note');
        });
      });

      test('schema "public" - check properties', () => {
        const schema = database.schemas[0];

        expect(schema.name).toEqual('public');
        expect(schema.note).toEqual(`Default ${_.capitalize(DEFAULT_SCHEMA_NAME)} Schema`);
      });

      test('schema "public" - contains all tables', () => {
        const schema = database.schemas[0];

        expect(schema.tables).toHaveLength(6);

        const tables = ['merchants', 'users', 'countries', 'order_items', 'orders', 'products'];
        expect(schema.tables.map(table => table.name)).toEqual(expect.arrayContaining(tables));
      });

      test('schema "public" - contains all enums', () => {
        const schema = database.schemas[0];

        expect(schema.enums).toHaveLength(1);

        const enums = ['products_status'];
        expect(schema.enums.map(_enum => _enum.name)).toEqual(expect.arrayContaining(enums));
      });

      test('schema "public" - contains all tableGroups', () => {
        const schema = database.schemas[0];

        expect(schema.tableGroups).toHaveLength(1);

        const tableGroups = ['g1'];
        expect(schema.tableGroups.map(group => group.name)).toEqual(expect.arrayContaining(tableGroups));
      });

      test('schema "public" - contains all parent references', () => {
        const schema = database.schemas[0];

        expect(schema.database.id).toEqual(1);
      });

      test('all refs - contains all properties', () => {
        database.refs.forEach((ref) => {
          expect(ref.id).toBeDefined();
          expect(ref.database).toBeDefined();
          expect(ref.endpoints).toBeDefined();

          expect(ref).toHaveProperty('name');
          expect(ref).toHaveProperty('onDelete');
          expect(ref).toHaveProperty('onUpdate');
        });
      });

      test('all enums - contains all properties', () => {
        const schema = database.schemas[0];
        schema.enums.forEach((_enum) => {
          expect(_enum.id).toBeDefined();
          expect(_enum.schema).toBeDefined();
          expect(_enum.name).toBeDefined();
          expect(_enum.values).toBeDefined();
          expect(_enum.fields).toBeDefined();

          expect(_enum).toHaveProperty('note');
        });
      });

      test('enum "products_status" - check properties', () => {
        const _enum = database.schemas[0].enums[0];

        expect(_enum.name).toEqual('products_status');
      });

      test('enum "products_status" contains all values', () => {
        const _enum = database.schemas[0].enums[0];

        expect(_enum.values).toHaveLength(3);

        const values = [
          {
            name: 'out_of_stock',
            note: null,
          },
          {
            name: 'in_stock',
            note: null,
          },
          {
            name: 'running_low',
            note: 'less than 20',
          },
        ];
        expect(_enum.values.map((value) => ({
          name: value.name,
          note: value.note ? value.note : null,
        }))).toEqual(expect.arrayContaining(values));
      });

      test('enum "products_status" contains all fields', () => {
        const _enum = database.schemas[0].enums[0];

        expect(_enum.fields).toHaveLength(1);

        const fields = ['status'];
        expect(_enum.fields.map((field) => field.name)).toEqual(expect.arrayContaining(fields));
      });

      test('enum "products_status" contains all parent references', () => {
        const _enum = database.schemas[0].enums[0];

        expect(_enum.schema.name).toEqual('public');
      });

      test('all tableGroups - contains all properties', () => {
        const schema = database.schemas[0];
        schema.tableGroups.forEach((group) => {
          expect(group.id).toBeDefined();
          expect(group.name).toBeDefined();
          expect(group.schema).toBeDefined();
          expect(group.tables).toBeDefined();
        });
      });

      test('tableGroup "g1" - check properties', () => {
        const group = database.schemas[0].tableGroups[0];

        expect(group.name).toEqual('g1');
      });

      test('tableGroup "g1" contains all tables', () => {
        const group = database.schemas[0].tableGroups[0];

        expect(group.tables).toHaveLength(2);

        const tables = ['users', 'merchants'];
        expect(group.tables.map((table) => table.name)).toEqual(expect.arrayContaining(tables));
      });

      test('tableGroup "g1" contains all parent references', () => {
        const group = database.schemas[0].tableGroups[0];

        expect(group.schema.name).toEqual('public');
      });

      test('all tables - contains all properties', () => {
        const schema = database.schemas[0];
        schema.tables.forEach((table) => {
          expect(table.id).toBeDefined();
          expect(table.name).toBeDefined();
          expect(table.schema).toBeDefined();
          expect(table.fields).toBeDefined();
          expect(table.indexes).toBeDefined();

          expect(table).toHaveProperty('alias');
          expect(table).toHaveProperty('note');
          expect(table).toHaveProperty('headerColor');
        });
      });

      test('table "users" - check properties', () => {
        const table = database.schemas[0].findTable('users');

        expect(table.name).toEqual('users');
        expect(table.alias).toEqual('U');
      });

      test('table "users - contains all fields', () => {
        const table = database.schemas[0].findTable('users');

        const fields = table.fields.map((field) => ({
          name: field.name,
          type: field.type,
          not_null: field.not_null,
          unique: field.unique,
          pk: field.pk,
          note: field.note,
          increment: field.increment,
          dbdefault: field.dbdefault,
        }));

        expect(fields).toEqual(expect.arrayContaining([
          expect.objectContaining({
            name: 'id',
            type: expect.objectContaining({
              type_name: 'int',
            }),
            increment: true,
            pk: true,
            note: 'Id of user',
          }),
          expect.objectContaining({
            name: 'full_name',
            type: expect.objectContaining({
              type_name: 'varchar',
            }),
            unique: true,
          }),
          expect.objectContaining({
            name: 'created_at',
            type: expect.objectContaining({
              type_name: 'timestamp',
            }),
            not_null: false,
            dbdefault: {
              type: 'expression',
              value: 'current_timestamp()',
            },
          }),
          expect.objectContaining({
            name: 'country_code',
            type: expect.objectContaining({
              type_name: 'int',
            }),
          }),
        ]));
      });

      test('table "users - contains all indexes', () => {
        const table = database.schemas[0].findTable('users');

        const indexes = table.indexes.map((index) => ({
          name: index.name,
          type: index.type,
          unique: index.unique,
          pk: index.pk,
          columns: index.columns.map((column) => ({
            type: column.type,
            value: column.value,
          })),
        }));

        expect(indexes).toEqual(expect.arrayContaining([
          expect.objectContaining({
            pk: true,
            columns: expect.arrayContaining([
              {
                type: 'column',
                value: 'id',
              },
              {
                type: 'column',
                value: 'full_name',
              },
            ]),
          }),
          expect.objectContaining({
            unique: true,
            name: 'time index',
            type: 'btree',
            columns: expect.arrayContaining([
              {
                type: 'expression',
                value: 'now()',
              },
            ]),
          }),
        ]));
      });

      test('table "users" - contains all parent references', () => {
        const table = database.schemas[0].findTable('users');

        expect(table.schema.name).toEqual('public');
        expect(table.group.name).toEqual('g1');
      });
    });

    describe('normalized_structure', () => {
      let normalizedModel;

      function getEle (ele, id) {
        return normalizedModel[ele][id];
      }

      beforeAll(() => {
        normalizedModel = database.normalize();
      });

      test('database - contains all properties', () => {
        expect(getEle('database', '1')).toBeDefined();
      });

      test('database - contains all schemas', () => {
        expect(getEle('database', '1').schema_ids).toHaveLength(1);

        // eslint-disable-next-line
        const schemas = getEle('database', '1').schema_ids.map((schema_id) => getEle('schemas', schema_id).name);
        expect(schemas).toEqual(expect.arrayContaining(['public']));
      });

      test('database - contains all refs', () => {
        expect(getEle('database', '1').ref_ids).toHaveLength(6);

        // eslint-disable-next-line
        const refs = getEle('database', '1').ref_ids.map((ref_id) => ({
          name: getEle('refs', ref_id).name,
          onDelete: getEle('refs', ref_id).onDelete,
          onUpdate: getEle('refs', ref_id).onUpdate,
          // eslint-disable-next-line
          endpoints: getEle('refs', ref_id).endpoint_ids.map((endpoint_id) => ({
            schemaName: getEle('schemas', getEle('tables', getEle('fields', getEle('endpoints', endpoint_id).field_id).table_id).schema_id).name,
            tableName: getEle('tables', getEle('fields', getEle('endpoints', endpoint_id).field_id).table_id).name,
            fieldName: getEle('fields', getEle('endpoints', endpoint_id).field_id).name,
            relation: getEle('endpoints', endpoint_id).relation,
          })),
        }));

        expect(refs).toEqual(expect.arrayContaining([
          expect.objectContaining({
            onDelete: 'cascade',
            onUpdate: 'no action',
            endpoints: expect.arrayContaining([
              {
                schemaName: 'public',
                tableName: 'users',
                fieldName: 'country_code',
                relation: '*',
              },
              {
                schemaName: 'public',
                tableName: 'countries',
                fieldName: 'code',
                relation: '1',
              },
            ]),
          }),
        ]));
      });

      test('schema "public" - check properties', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);

        expect(schema.name).toEqual('public');
        expect(schema.note).toEqual(`Default ${_.capitalize(DEFAULT_SCHEMA_NAME)} Schema`);
      });

      test('schema "public" - contains all tables', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);

        expect(schema.table_ids).toHaveLength(6);

        const tables = ['merchants', 'users', 'countries', 'order_items', 'orders', 'products'];
        // eslint-disable-next-line
        expect(schema.table_ids.map((table_id) => getEle('tables', table_id).name)).toEqual(expect.arrayContaining(tables));
      });

      test('schema "public" - contains all enums', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);

        expect(schema.enum_ids).toHaveLength(1);

        const enums = ['products_status'];
        // eslint-disable-next-line
        expect(schema.enum_ids.map((enum_id) => getEle('enums', enum_id).name)).toEqual(expect.arrayContaining(enums));
      });

      test('schema "public" - contains all tableGroups', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);

        expect(schema.tableGroup_ids).toHaveLength(1);

        const tableGroups = ['g1'];
        // eslint-disable-next-line
        expect(schema.tableGroup_ids.map((group_id) => getEle('tableGroups', group_id).name)).toEqual(expect.arrayContaining(tableGroups));
      });

      test('schema "public" - contains all parent references', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);

        expect(schema.database_id).toEqual(1);
      });

      test('enum "products_status" - check properties', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);
        const _enum = getEle('enums', schema.enum_ids[0]);

        expect(_enum.name).toEqual('products_status');
      });

      test('enum "products_status" contains all values', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);
        const _enum = getEle('enums', schema.enum_ids[0]);

        expect(_enum.value_ids).toHaveLength(3);

        const values = [
          {
            name: 'out_of_stock',
            note: null,
          },
          {
            name: 'in_stock',
            note: null,
          },
          {
            name: 'running_low',
            note: 'less than 20',
          },
        ];
        // eslint-disable-next-line
        expect(_enum.value_ids.map((value_id) => ({
          name: getEle('enumValues', value_id).name,
          note: getEle('enumValues', value_id).note ? getEle('enumValues', value_id).note : null,
        }))).toEqual(expect.arrayContaining(values));
      });

      test('enum "products_status" contains all fields', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);
        const _enum = getEle('enums', schema.enum_ids[0]);

        expect(_enum.field_ids).toHaveLength(1);

        const fields = ['status'];
        // eslint-disable-next-line
        expect(_enum.field_ids.map((field_id) => getEle('fields', field_id).name)).toEqual(expect.arrayContaining(fields));
      });

      test('enum "products_status" contains all parent references', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);
        const _enum = getEle('enums', schema.enum_ids[0]);

        expect(getEle('schemas', _enum.schema_id).name).toEqual('public');
      });

      test('tableGroup "g1" - check properties', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);
        const group = getEle('tableGroups', schema.tableGroup_ids[0]);

        expect(group.name).toEqual('g1');
      });

      test('tableGroup "g1" contains all tables', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);
        const group = getEle('tableGroups', schema.tableGroup_ids[0]);

        expect(group.table_ids).toHaveLength(2);

        const tables = ['users', 'merchants'];
        // eslint-disable-next-line
        expect(group.table_ids.map((table_id) => getEle('tables', table_id).name)).toEqual(expect.arrayContaining(tables));
      });

      test('tableGroup "g1" contains all parent references', () => {
        const schema = getEle('schemas', getEle('database', '1').schema_ids[0]);
        const group = getEle('tableGroups', schema.tableGroup_ids[0]);

        expect(getEle('schemas', group.schema_id).name).toEqual('public');
      });

      test('table "users" - check properties', () => {
        const tableId = Object.keys(normalizedModel.tables).find((key) => getEle('tables', key).name === 'users');
        const table = getEle('tables', tableId);

        expect(table.name).toEqual('users');
        expect(table.alias).toEqual('U');
      });

      test('table "users - contains all fields', () => {
        const tableId = Object.keys(normalizedModel.tables).find((key) => getEle('tables', key).name === 'users');
        const table = getEle('tables', tableId);

        // eslint-disable-next-line
        const fields = table.field_ids.map((field_id) => ({
          name: getEle('fields', field_id).name,
          type: getEle('fields', field_id).type,
          not_null: getEle('fields', field_id).not_null,
          unique: getEle('fields', field_id).unique,
          pk: getEle('fields', field_id).pk,
          note: getEle('fields', field_id).note,
          increment: getEle('fields', field_id).increment,
          dbdefault: getEle('fields', field_id).dbdefault,
        }));

        expect(fields).toEqual(expect.arrayContaining([
          expect.objectContaining({
            name: 'id',
            type: expect.objectContaining({
              type_name: 'int',
            }),
            increment: true,
            pk: true,
            note: 'Id of user',
          }),
          expect.objectContaining({
            name: 'full_name',
            type: expect.objectContaining({
              type_name: 'varchar',
            }),
            unique: true,
          }),
          expect.objectContaining({
            name: 'created_at',
            type: expect.objectContaining({
              type_name: 'timestamp',
            }),
            not_null: false,
            dbdefault: {
              type: 'expression',
              value: 'current_timestamp()',
            },
          }),
          expect.objectContaining({
            name: 'country_code',
            type: expect.objectContaining({
              type_name: 'int',
            }),
          }),
        ]));
      });

      test('table "users - contains all indexes', () => {
        const tableId = Object.keys(normalizedModel.tables).find((key) => getEle('tables', key).name === 'users');
        const table = getEle('tables', tableId);

        // eslint-disable-next-line
        const indexes = table.index_ids.map((index_id) => ({
          name: getEle('indexes', index_id).name,
          type: getEle('indexes', index_id).type,
          unique: getEle('indexes', index_id).unique,
          pk: getEle('indexes', index_id).pk,
          // eslint-disable-next-line
          columns: getEle('indexes', index_id).column_ids.map((column_id) => ({
            type: getEle('indexColumns', column_id).type,
            value: getEle('indexColumns', column_id).value,
          })),
        }));

        expect(indexes).toEqual(expect.arrayContaining([
          expect.objectContaining({
            pk: true,
            columns: expect.arrayContaining([
              {
                type: 'column',
                value: 'id',
              },
              {
                type: 'column',
                value: 'full_name',
              },
            ]),
          }),
          expect.objectContaining({
            unique: true,
            name: 'time index',
            type: 'btree',
            columns: expect.arrayContaining([
              {
                type: 'expression',
                value: 'now()',
              },
            ]),
          }),
        ]));
      });

      test('table "users" - contains all parent references', () => {
        const tableId = Object.keys(normalizedModel.tables).find((key) => getEle('tables', key).name === 'users');
        const table = getEle('tables', tableId);

        expect(getEle('schemas', table.schema_id).name).toEqual('public');
        expect(getEle('tableGroups', table.group_id).name).toEqual('g1');
      });
    });
  });
});
