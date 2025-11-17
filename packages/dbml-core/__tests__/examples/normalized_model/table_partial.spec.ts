// import * as fs from 'fs';
import { readFileSync } from 'fs';
import expectedNormalizeModel from './table_partial.out.json';
import Parser from '../../../src/parse/Parser';
import Database from 'model_structure/database';
import { NormalizedDatabase } from '../../../types/model_structure/database';
import { isEqualExcludeTokenEmpty } from '../testHelpers';
import path from 'path';

describe('@dbml/core - normalized_structure', () => {
  let dbml: string | undefined;
  let database: Database | undefined;
  let normalizedModel: NormalizedDatabase | undefined;

  beforeAll(() => {
    try {
      dbml = readFileSync(path.resolve(__dirname, 'table_partial.in.dbml'), { encoding: 'utf8' });
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
        isEqualExcludeTokenEmpty(normalizedModel, expectedNormalizeModel);
        done();
      });
    });
  });
});
