import _ from 'lodash';
import Database from '../../src/model_structure/database';
import jsonDb from './table_partial.json';
import { DEFAULT_SCHEMA_NAME } from '../../src/model_structure/config';

describe('@dbml/core - model_structure', () => {
  let database;

  beforeAll(() => {
    database = new Database(jsonDb);
  });

  describe('general_schema', () => {
    describe('nested_structure', () => {
      // test('table "users" - contains all parent references', () => {
      //   const table = database.schemas[0].findTable('users');

      //   expect(table.schema.name).toEqual(DEFAULT_SCHEMA_NAME);
      //   expect(table.group.name).toEqual('g1');
      // });
      test('table partial has correct properties', () => {
        const tablePartial = database.tablePartials[0];
        expect(tablePartial.name).toEqual('base_template');
        expect(tablePartial.fields.length).toEqual(1);

        const field0 = tablePartial.fields[0];
        expect(field0.name).toEqual('id');
        expect(field0.type.type_name).toEqual('int');
      });

      test('table "users" has all fields and in correct order after merged with the partials', () => {
        const table = database.schemas[0].findTable('users');
        const fields = table.fields.map(f => f.name);
  
        expect(fields).toEqual(['name', 'id', 'email', 'created_at', 'updated_at']);
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

      // test('table "users" - contains all parent references', () => {
      //   const tableId = Object.keys(normalizedModel.tables).find((key) => getEle('tables', key).name === 'users');
      //   const table = getEle('tables', tableId);

      //   expect(getEle('schemas', table.schemaId).name).toEqual(DEFAULT_SCHEMA_NAME);
      //   expect(getEle('tableGroups', table.groupId).name).toEqual('g1');
      // });
      test('ok', () => {

      });
    });
  });
});
