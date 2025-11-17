import _ from 'lodash';
import Database from '../../../src/model_structure/database';
import jsonDb from './single_schema.json';
import { DEFAULT_SCHEMA_NAME } from '../../../src/model_structure/config';
import { NormalizedDatabase } from '../../../types/model_structure/database';

describe('@dbml/core - model_structure', () => {
  let database: Database | undefined;

  beforeAll(() => {
    database = new Database(jsonDb as any);
  });

  describe('general_schema', () => {
    describe('nested_structure', () => {
      test('database - contains all properties', () => {
        expect(database!.id).toBeDefined();
        expect(database!.schemas).toBeDefined();
        expect(database!.note).toBeDefined();
        expect(database!.databaseType).toBeDefined();
      });

      test('database - check properties', () => {
        expect(database!.note).toEqual('# Introduction\nThis is an ecommerce project\n\n# Description\n...');
        expect(database!.databaseType).toEqual('PostgreSQL');
        expect(database!.name).toEqual('ecommerce');
      });

      test('database - contains all schemas', () => {
        expect(database!.schemas).toHaveLength(1);

        expect(database!.schemas.map((schema) => schema.name)).toEqual(expect.arrayContaining([DEFAULT_SCHEMA_NAME]));
      });

      test('all schemas - contains all properties', () => {
        database!.schemas.forEach((schema) => {
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
        const schema = database!.schemas[0];

        expect(schema.name).toEqual(DEFAULT_SCHEMA_NAME);
        expect(schema.note).toEqual(`Default ${_.capitalize(DEFAULT_SCHEMA_NAME)} Schema`);
      });

      test('schema "public" - contains all tables', () => {
        const schema = database!.schemas[0];

        expect(schema.tables).toHaveLength(6);

        const tables = ['merchants', 'users', 'countries', 'order_items', 'orders', 'products'];
        expect(schema.tables.map((table: any) => table.name)).toEqual(expect.arrayContaining(tables));
      });

      test('schema "public" - contains all enums', () => {
        const schema = database!.schemas[0];

        expect(schema.enums).toHaveLength(1);

        const enums = ['products_status'];
        expect(schema.enums.map((_enum: any) => _enum.name)).toEqual(expect.arrayContaining(enums));
      });

      test('schema "public" - contains all tableGroups', () => {
        const schema = database!.schemas[0];

        expect(schema.tableGroups).toHaveLength(1);

        const tableGroups = ['g1'];
        expect(schema.tableGroups.map((group: any) => group.name)).toEqual(expect.arrayContaining(tableGroups));
      });

      test('schema "public" - contains all refs', () => {
        const schema = database!.schemas[0];
        expect(schema.refs).toHaveLength(7);

        const refs = schema.refs.map((ref: any) => ({
          name: ref.name,
          onDelete: ref.onDelete,
          onUpdate: ref.onUpdate,
          endpoints: ref.endpoints.map((endpoint: any) => ({
            schemaName: endpoint.fields[0].table.schema.name,
            tableName: endpoint.fields[0].table.name,
            fieldNames: endpoint.fields.map((field: any) => field.name),
            relation: endpoint.relation,
          })),
        }));

        expect(refs).toEqual(expect.arrayContaining([
          expect.objectContaining({
            onDelete: 'cascade',
            onUpdate: 'no action',
            endpoints: expect.arrayContaining([
              {
                schemaName: DEFAULT_SCHEMA_NAME,
                tableName: 'users',
                fieldNames: ['country_code'],
                relation: '*',
              },
              {
                schemaName: DEFAULT_SCHEMA_NAME,
                tableName: 'countries',
                fieldNames: ['code'],
                relation: '1',
              },
            ]),
          }),
          expect.objectContaining({
            endpoints: expect.arrayContaining([
              {
                schemaName: DEFAULT_SCHEMA_NAME,
                tableName: 'products',
                fieldNames: [
                  'id',
                  'name',
                ],
                relation: '1',
              },
              {
                schemaName: DEFAULT_SCHEMA_NAME,
                tableName: 'order_items',
                fieldNames: [
                  'product_id',
                  'product_name',
                ],
                relation: '*',
              },
            ]),
          }),
        ]));
      });

      test('schema "public" - contains all parent references', () => {
        const schema = database!.schemas[0];

        expect(schema.database.id).toEqual(1);
      });

      test('all refs - contains all properties', () => {
        const schema = database!.schemas[0];
        schema.refs.forEach((ref: any) => {
          expect(ref.id).toBeDefined();
          expect(ref.schema).toBeDefined();
          expect(ref.endpoints).toBeDefined();

          expect(ref).toHaveProperty('name');
          expect(ref).toHaveProperty('onDelete');
          expect(ref).toHaveProperty('onUpdate');
        });
      });

      test('all enums - contains all properties', () => {
        const schema = database!.schemas[0];
        schema.enums.forEach((_enum: any) => {
          expect(_enum.id).toBeDefined();
          expect(_enum.schema).toBeDefined();
          expect(_enum.name).toBeDefined();
          expect(_enum.values).toBeDefined();
          expect(_enum.fields).toBeDefined();

          expect(_enum).toHaveProperty('note');
        });
      });

      test('enum "products_status" - check properties', () => {
        const _enum = database!.schemas[0].enums[0];

        expect(_enum.name).toEqual('products_status');
      });

      test('enum "products_status" contains all values', () => {
        const _enum = database!.schemas[0].enums[0];

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
        expect(_enum.values.map((value: any) => ({
          name: value.name,
          note: value.note ? value.note : null,
        }))).toEqual(expect.arrayContaining(values));
      });

      test('enum "products_status" contains all fields', () => {
        const _enum = database!.schemas[0].enums[0];

        expect(_enum.fields).toHaveLength(1);

        const fields = ['status'];
        expect(_enum.fields.map((field: any) => field.name)).toEqual(expect.arrayContaining(fields));
      });

      test('enum "products_status" contains all parent references', () => {
        const _enum = database!.schemas[0].enums[0];

        expect(_enum.schema.name).toEqual(DEFAULT_SCHEMA_NAME);
      });

      test('all tableGroups - contains all properties', () => {
        const schema = database!.schemas[0];
        schema.tableGroups.forEach((group: any) => {
          expect(group.id).toBeDefined();
          expect(group.name).toBeDefined();
          expect(group.schema).toBeDefined();
          expect(group.tables).toBeDefined();
        });
      });

      test('tableGroup "g1" - check properties', () => {
        const group = database!.schemas[0].tableGroups[0];

        expect(group.name).toEqual('g1');
      });

      test('tableGroup "g1" contains all tables', () => {
        const group = database!.schemas[0].tableGroups[0];

        expect(group.tables).toHaveLength(2);

        const tables = ['users', 'merchants'];
        expect(group.tables.map((table: any) => table.name)).toEqual(expect.arrayContaining(tables));
      });

      test('tableGroup "g1" contains all parent references', () => {
        const group = database!.schemas[0].tableGroups[0];

        expect(group.schema.name).toEqual(DEFAULT_SCHEMA_NAME);
      });

      test('all tables - contains all properties', () => {
        const schema = database!.schemas[0];
        schema.tables.forEach((table: any) => {
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
        const table = database!.schemas[0].findTable('users');

        expect(table.name).toEqual('users');
        expect(table.alias).toEqual('U');
      });

      test('table "users - contains all fields', () => {
        const table = database!.schemas[0].findTable('users');

        const fields = table.fields.map((field: any) => ({
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
        const table = database!.schemas[0].findTable('users');

        const indexes = table.indexes.map((index: any) => ({
          name: index.name,
          type: index.type,
          unique: index.unique,
          pk: index.pk,
          note: index.note,
          columns: index.columns.map((column: any) => ({
            type: column.type,
            value: column.value,
          })),
        }));

        expect(indexes).toEqual(expect.arrayContaining([
          expect.objectContaining({
            pk: true,
            note: 'index note',
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
        const table = database!.schemas[0].findTable('users');

        expect(table.schema.name).toEqual(DEFAULT_SCHEMA_NAME);
        expect(table.group.name).toEqual('g1');
      });
    });

    describe('normalized_structure', () => {
      let normalizedModel: NormalizedDatabase | undefined;

      function getEle (ele: keyof NormalizedDatabase, id: string) {
        return (normalizedModel![ele] as any)[id];
      }

      beforeAll(() => {
        normalizedModel = database!.normalize();
      });

      test('database - contains all properties', () => {
        const database = getEle('database', '1');
        expect(database.id).toBeDefined();
        expect(database.schemaIds).toBeDefined();
        expect(database.note).toBeDefined();
        expect(database.databaseType).toBeDefined();
      });

      test('database - check properties', () => {
        const database = getEle('database', '1');
        expect(database.note).toEqual('# Introduction\nThis is an ecommerce project\n\n# Description\n...');
        expect(database.databaseType).toEqual('PostgreSQL');
        expect(database.name).toEqual('ecommerce');
      });

      test('database - contains all schemas', () => {
        expect(getEle('database', '1').schemaIds).toHaveLength(1);

        const schemas = getEle('database', '1').schemaIds.map((schemaId: any) => getEle('schemas', schemaId).name);
        expect(schemas).toEqual(expect.arrayContaining([DEFAULT_SCHEMA_NAME]));
      });

      test('schema "public" - check properties', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);

        expect(schema.name).toEqual(DEFAULT_SCHEMA_NAME);
        expect(schema.note).toEqual(`Default ${_.capitalize(DEFAULT_SCHEMA_NAME)} Schema`);
      });

      test('schema "public" - contains all tables', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);

        expect(schema.tableIds).toHaveLength(6);

        const tables = ['merchants', 'users', 'countries', 'order_items', 'orders', 'products'];

        expect(schema.tableIds.map((tableId: any) => getEle('tables', tableId).name)).toEqual(expect.arrayContaining(tables));
      });

      test('schema "public" - contains all enums', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);

        expect(schema.enumIds).toHaveLength(1);

        const enums = ['products_status'];

        expect(schema.enumIds.map((enumId: any) => getEle('enums', enumId).name)).toEqual(expect.arrayContaining(enums));
      });

      test('schema "public" - contains all tableGroups', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);

        expect(schema.tableGroupIds).toHaveLength(1);

        const tableGroups = ['g1'];

        expect(schema.tableGroupIds.map((groupId: any) => getEle('tableGroups', groupId).name)).toEqual(expect.arrayContaining(tableGroups));
      });

      test('schema "public" - contains all refs', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);
        expect(schema.refIds).toHaveLength(7);

        const refs = schema.refIds.map((refId: any) => ({
          name: getEle('refs', refId).name,
          onDelete: getEle('refs', refId).onDelete,
          onUpdate: getEle('refs', refId).onUpdate,

          endpoints: getEle('refs', refId).endpointIds.map((endpointId: any) => ({
            schemaName: getEle('schemas', getEle('tables', getEle('fields', getEle('endpoints', endpointId).fieldIds[0]).tableId).schemaId).name,
            tableName: getEle('tables', getEle('fields', getEle('endpoints', endpointId).fieldIds[0]).tableId).name,
            fieldNames: getEle('endpoints', endpointId).fieldIds.map((fieldId: any) => {
              return getEle('fields', fieldId).name;
            }),
            relation: getEle('endpoints', endpointId).relation,
          })),
        }));

        expect(refs).toEqual(expect.arrayContaining([
          expect.objectContaining({
            onDelete: 'cascade',
            onUpdate: 'no action',
            endpoints: expect.arrayContaining([
              {
                schemaName: DEFAULT_SCHEMA_NAME,
                tableName: 'users',
                fieldNames: ['country_code'],
                relation: '*',
              },
              {
                schemaName: DEFAULT_SCHEMA_NAME,
                tableName: 'countries',
                fieldNames: ['code'],
                relation: '1',
              },
            ]),
          }),
          expect.objectContaining({
            endpoints: expect.arrayContaining([
              {
                schemaName: DEFAULT_SCHEMA_NAME,
                tableName: 'products',
                fieldNames: [
                  'id',
                  'name',
                ],
                relation: '1',
              },
              {
                schemaName: DEFAULT_SCHEMA_NAME,
                tableName: 'order_items',
                fieldNames: [
                  'product_id',
                  'product_name',
                ],
                relation: '*',
              },
            ]),
          }),
        ]));
      });

      test('schema "public" - contains all parent references', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);

        expect(schema.databaseId).toEqual(1);
      });

      test('enum "products_status" - check properties', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);
        const _enum = getEle('enums', schema.enumIds[0]);

        expect(_enum.name).toEqual('products_status');
      });

      test('enum "products_status" contains all values', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);
        const _enum = getEle('enums', schema.enumIds[0]);

        expect(_enum.valueIds).toHaveLength(3);

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

        expect(_enum.valueIds.map((valueId: any) => ({
          name: getEle('enumValues', valueId).name,
          note: getEle('enumValues', valueId).note ? getEle('enumValues', valueId).note : null,
        }))).toEqual(expect.arrayContaining(values));
      });

      test('enum "products_status" contains all fields', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);
        const _enum = getEle('enums', schema.enumIds[0]);

        expect(_enum.fieldIds).toHaveLength(1);

        const fields = ['status'];

        expect(_enum.fieldIds.map((fieldId: any) => getEle('fields', fieldId).name)).toEqual(expect.arrayContaining(fields));
      });

      test('enum "products_status" contains all parent references', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);
        const _enum = getEle('enums', schema.enumIds[0]);

        expect(getEle('schemas', _enum.schemaId).name).toEqual(DEFAULT_SCHEMA_NAME);
      });

      test('tableGroup "g1" - check properties', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);
        const group = getEle('tableGroups', schema.tableGroupIds[0]);

        expect(group.name).toEqual('g1');
      });

      test('tableGroup "g1" contains all tables', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);
        const group = getEle('tableGroups', schema.tableGroupIds[0]);

        expect(group.tableIds).toHaveLength(2);

        const tables = ['users', 'merchants'];

        expect(group.tableIds.map((tableId: any) => getEle('tables', tableId).name)).toEqual(expect.arrayContaining(tables));
      });

      test('tableGroup "g1" contains all parent references', () => {
        const schema = getEle('schemas', getEle('database', '1').schemaIds[0]);
        const group = getEle('tableGroups', schema.tableGroupIds[0]);

        expect(getEle('schemas', group.schemaId).name).toEqual(DEFAULT_SCHEMA_NAME);
      });

      test('table "users" - check properties', () => {
        const tableId = Object.keys(normalizedModel!.tables).find((key) => getEle('tables', key).name === 'users');
        const table = getEle('tables', tableId!);

        expect(table.name).toEqual('users');
        expect(table.alias).toEqual('U');
      });

      test('table "users - contains all fields', () => {
        const tableId = Object.keys(normalizedModel!.tables).find((key) => getEle('tables', key).name === 'users');
        const table = getEle('tables', tableId!);

        const fields = table.fieldIds.map((fieldId: any) => ({
          name: getEle('fields', fieldId).name,
          type: getEle('fields', fieldId).type,
          not_null: getEle('fields', fieldId).not_null,
          unique: getEle('fields', fieldId).unique,
          pk: getEle('fields', fieldId).pk,
          note: getEle('fields', fieldId).note,
          increment: getEle('fields', fieldId).increment,
          dbdefault: getEle('fields', fieldId).dbdefault,
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
        const tableId = Object.keys(normalizedModel!.tables).find((key) => getEle('tables', key).name === 'users');
        const table = getEle('tables', tableId!);

        const indexes = table.indexIds.map((indexId: any) => ({
          name: getEle('indexes', indexId).name,
          type: getEle('indexes', indexId).type,
          unique: getEle('indexes', indexId).unique,
          pk: getEle('indexes', indexId).pk,
          note: getEle('indexes', indexId).note,

          columns: getEle('indexes', indexId).columnIds.map((columnId: any) => ({
            type: getEle('indexColumns', columnId).type,
            value: getEle('indexColumns', columnId).value,
          })),
        }));

        expect(indexes).toEqual(expect.arrayContaining([
          expect.objectContaining({
            pk: true,
            note: 'index note',
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
        const tableId = Object.keys(normalizedModel!.tables).find((key) => getEle('tables', key).name === 'users');
        const table = getEle('tables', tableId!);

        expect(getEle('schemas', table.schemaId).name).toEqual(DEFAULT_SCHEMA_NAME);
        expect(getEle('tableGroups', table.groupId).name).toEqual('g1');
      });
    });
  });
});
