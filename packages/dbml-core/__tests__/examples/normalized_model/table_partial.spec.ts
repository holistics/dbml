import { readFileSync } from 'fs';
import expectedNormalizeModel from './table_partial.out.json';
import Parser from '../../../src/parse/Parser';
import { NormalizedDatabase } from '../../../types/model_structure/database';
import { isEqualExcludeTokenEmpty } from '../testHelpers';
import path from 'path';

describe('@dbml/core - normalized_structure', () => {
  let normalizedModel: NormalizedDatabase;

  beforeAll(() => {
    const dbml = readFileSync(path.resolve(__dirname, 'table_partial.in.dbml'), { encoding: 'utf8' });
    const database = (new Parser()).parse(dbml, 'dbmlv2');
    normalizedModel = database.normalize();
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
