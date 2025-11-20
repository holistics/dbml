import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  dbmlSchemaArbitrary,
} from './arbitraries/grammars';
import { interpret } from './utils';

// This is more like fuzzing than property-based testing
describe('[fuzzer] interpreter', () => {
  it('should interpret any sources without errors', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        expect(() => interpret(source)).not.toThrow();
      }),
    );
  });

  it('should interpret any schemas without errors', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        expect(() => interpret(source)).not.toThrow();
      }),
    );
  });
});
