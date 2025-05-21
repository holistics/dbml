// import * as fs from 'fs';
import dbml from './table_partial.in.dbml';
import expectedNormalizeModel from './table_partial.out.json';
import Parser from '../../src/parse/Parser';

describe('@dbml/core - normalized_structure', () => {
  let database;
  let normalizedModel;

  beforeAll(() => {
    try {
      database = (new Parser()).parse(dbml, 'dbmlv2');
      // fs.writeFile('./json.txt', JSON.stringify(Parser.parseDBMLToJSONv2(dbml), null, 2), { flag: 'w+' }, err => {});
      normalizedModel = database.normalize();
      // fs.writeFile('./normalized.txt', JSON.stringify(normalizedModel, null, 2), { flag: 'w+' }, err => {});
    } catch (err) {
      console.log('error', err);
    }
  });

  describe('table_partial', () => {
    describe('normalized_structure', () => {
      test('normalized database - contains all properties', (done) => {
        // eslint-disable-next-line no-undef
        isEqualExcludeTokenEmpty(normalizedModel, expectedNormalizeModel);
        done();
      });
    });
  });
});
