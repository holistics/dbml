import _ from 'lodash';
import Database from '../../src/model_structure/database';
import jsonDb from './table_partial.json';
import { DEFAULT_SCHEMA_NAME } from '../../src/model_structure/config';

describe('@dbml/core - model_structure', () => {
  let database;

  beforeAll(() => {
    database = new Database(jsonDb);
  });

  describe('table_partial_schema', () => {
    describe('nested_structure', () => {
      test('table partial has correct properties', () => {
        const tablePartial = database.tablePartials[0];
        expect(tablePartial.name).toEqual('base_template');
        expect(tablePartial.fields.length).toEqual(3);

        const field0 = tablePartial.fields[0];
        expect(field0.name).toEqual('id');
        expect(field0.type.type_name).toEqual('int');
      });

      test('table "users" has all fields and in correct order after merged with the partials', () => {
        const table = database.schemas[0].findTable('users');
        const fields = table.fields.map(f => f.name);
  
        expect(fields).toEqual(['id', 'id2', 'name', 'email', 'created_at', 'updated_at', 'a', 'b']);
      });

      test('table "users" has inline_refs from table partial', () => {
        const table = database.schemas[0].findTable('users');
        expect(database.schemas[0].refs.length).toEqual(1);
        const ref0 = database.schemas[0].refs[0];
        expect(ref0.endpoints.length).toEqual(2);
        expect(ref0.endpoints[0].tableName).toEqual('users');
        expect(ref0.endpoints[0].fieldNames).toEqual(['id2']);
        expect(ref0.endpoints[0].relation).toEqual('1');
        expect(ref0.endpoints[1].tableName).toEqual('users');
        expect(ref0.endpoints[1].fieldNames).toEqual(['id']);
        expect(ref0.endpoints[1].relation).toEqual('1');
      });

      test('table settings from partial is injected in the correct order', () => {
        const table = database.schemas[0].findTable('users');
        expect(table.note).toEqual('time_template note');
      });
    });
  });
});
