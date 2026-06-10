import { readFileSync } from 'fs';
import Parser from '../../../src/parse/Parser';
import { NormalizedModel } from '../../../types/model_structure/database';
import path from 'path';
import { test, beforeAll, describe, expect } from 'vitest';

describe('@dbml/core - normalized_structure', () => {
  let normalizedModel: NormalizedModel;

  beforeAll(() => {
    const dbml = readFileSync(path.resolve(__dirname, 'dep_pipeline.in.dbml'), { encoding: 'utf8' });
    const database = (new Parser()).parse(dbml, 'dbmlv2');
    normalizedModel = database.normalize();
  });

  describe('dep_pipeline', () => {
    test('normalized database matches snapshot', () => {
      const serialized = JSON.stringify(normalizedModel, null, 2);
      expect(serialized).toMatchFileSnapshot(path.resolve(__dirname, 'dep_pipeline.out.json'));
    });
  });
});
