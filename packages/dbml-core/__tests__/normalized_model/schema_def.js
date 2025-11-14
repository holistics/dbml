// import * as fs from 'fs';
import dbml from './schema_def.in.dbml';
import expectedNormalizeModel from './schema_def.out.json';
import Parser from '../../src/parse/Parser';

describe('@dbml/core - model_structure', () => {
  let database;
  let normalizedModel;

  beforeAll(() => {
    try {
      database = (new Parser()).parse(dbml, 'dbmlv2');
      // fs.writeFile('./json.txt', JSON.stringify((new Parser()).parseDBMLToJSON(dbml), null, 2), { flag: 'w+' }, err => {});
      normalizedModel = database.normalize();
      // fs.writeFile('./normalized.txt', JSON.stringify(normalizedModel, null, 2), { flag: 'w+' }, err => {});
    } catch (err) {
      console.log('error', err);
    }
  });

  describe('multiple_schema', () => {
    describe('normalized_structure', () => {
      test('normalized database - contains all properties', (done) => {
        isEqualExcludeTokenEmpty(normalizedModel, expectedNormalizeModel);
        done();
      });
    });
  });
});
