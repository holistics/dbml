// import * as fs from 'fs';
import dbml from './table_partial.in.dbml';
import expectedNormalizeModel from './table_partial.out.json';
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
      console.log('error', JSON.stringify(err, null, 2));
    }
  });

  describe('multiple_schema', () => {
    describe('normalized_structure', () => {
      test('normalized database - contains all properties', (done) => {
        // eslint-disable-next-line no-undef
        isEqualExcludeTokenEmpty(normalizedModel, expectedNormalizeModel);
        done();
      });
    });
  });
});
