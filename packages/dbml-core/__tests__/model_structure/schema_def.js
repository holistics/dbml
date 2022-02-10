import _ from 'lodash';
import Database from '../../src/model_structure/database';
import dbml from './schema_def.dbml';
import Parser from '../../src/parse/Parser';
import { DEFAULT_SCHEMA_NAME } from '../../src/model_structure/config';

describe('@dbml/core - model_structure', () => {
  let database;

  beforeAll(() => {
    try {
      database = Parser.parse(dbml, 'dbml');
    } catch (err) {
      console.log('error', err);
    }
  });

  describe('multiple_schema', () => {
    describe('nested_structure', () => {
      test('database - contains all properties', (done) => {
        console.log(database);
        done();
      });
    });

    describe('normalized_structure', () => {
      let normalizedModel;

      beforeAll(() => {
        normalizedModel = database.normalize();
      });

      test('normalized database - contains all properties', (done) => {
        console.log(normalizedModel);
        done();
      });
    });
  });
});
