import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  smallSchemaArbitrary,
} from './arbitraries/grammars';
import { isEqual } from 'lodash-es';
import { parse, print } from './utils';

describe('parsing', () => {
  it('should produce consistent ASTs', () => {
    // Property: Parsing the same source twice should produce the same ASTs
    fc.assert(
      fc.property(smallSchemaArbitrary, (source: string) => {
        const result1 = parse(source);
        const result2 = parse(source);
        expect(isEqual(result1, result2)).toBeTruthy();
      }),
    );
  });

  it('should roundtrip with valid DBML', () => {
    // Property: Source 1 -parse-> ast -print-> Source 2
    // Then: Source 1 === Source 2
    fc.assert(
      fc.property(smallSchemaArbitrary, (source: string) => {
        const ast = parse(source).getValue().ast;
        const newSource = print(source, ast);
        expect(source).toEqual(newSource);
      }),
    );
  });

  it('should roundtrip with random strings', () => {
    // Property: Source 1 -parse-> ast -print-> Source 2
    // Then: Source 1 === Source 2
    fc.assert(
      fc.property(fc.string(), (source: string) => {
        const ast = parse(source).getValue().ast;
        const newSource = print(source, ast);
        expect(source).toEqual(newSource);
      }),
    );
  });
});
