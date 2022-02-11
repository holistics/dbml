import _ from 'lodash';
import Database from '../../src/model_structure/database';
import dbml from './schema_def.in.dbml';
import expectedNormalizeModel from './schema_def.out.json';
import Parser from '../../src/parse/Parser';
import { DEFAULT_SCHEMA_NAME } from '../../src/model_structure/config';
import fs from 'fs';

describe('@dbml/core - model_structure', () => {
  let database;
  let normalizedModel;

  beforeAll(() => {
    try {
      database = Parser.parse(dbml, 'dbml');
      normalizedModel = database.normalize();
      // fs.writeFile('./out.txt', JSON.stringify(normalizedModel, null, 2), { flag: 'w+' }, err => {});
    } catch (err) {
      console.log('error', err);
    }
  });

  describe('multiple_schema', () => {
    describe('normalized_structure', () => {
      test('normalized database - contains all properties', (done) => {
        expect(normalizedModel).toEqual(expectedNormalizeModel);
        done();
      });
    });
  });
});
