// import * as fs from 'fs';
import { readFileSync } from 'fs';
import expectedNormalizeModel from './schema_def.out.json';
import Parser from '../../../src/parse/Parser';
import Database from 'model_structure/database';
import { NormalizedDatabase } from '../../../types/model_structure/database';
import { isEqualExcludeTokenEmpty } from '../testHelpers';
import path from 'path';

describe('@dbml/core - model_structure', () => {
  let dbml: string | undefined;
  let database: Database | undefined;
  let normalizedModel: NormalizedDatabase | undefined;

  beforeAll(() => {
    try {
      dbml = readFileSync(path.resolve(__dirname, 'schema_def.in.dbml'), { encoding: 'utf8' });
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
