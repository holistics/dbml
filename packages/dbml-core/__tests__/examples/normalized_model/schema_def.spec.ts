import { readFileSync } from 'fs';
import expectedNormalizeModel from './schema_def.out.json';
import Parser from '../../../src/parse/Parser';
import { NormalizedDatabase } from '../../../types/model_structure/database';
import { isEqualExcludeTokenEmpty } from '../testHelpers';
import path from 'path';

describe('@dbml/core - model_structure', () => {
  let normalizedModel: NormalizedDatabase;

  beforeAll(() => {
    const dbml = readFileSync(path.resolve(__dirname, 'schema_def.in.dbml'), { encoding: 'utf8' });
    const database = (new Parser()).parse(dbml, 'dbmlv2');
    normalizedModel = database.normalize();
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
