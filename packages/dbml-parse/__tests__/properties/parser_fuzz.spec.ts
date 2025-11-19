import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  tableArbitrary,
  enumArbitrary,
  anyRefArbitrary,
  tableGroupArbitrary,
  projectArbitrary,
  standaloneNoteArbitrary,
  smallSchemaArbitrary,
} from './arbitraries/grammars';
import { parse } from './utils';

// This is more like fuzzing than property-based testing
describe('[fuzzer] parsing', () => {
  it('should parse valid tables without errors', () => {
    // Property: Valid table definitions should parse without errors
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const parseResult = parse(source);
        expect(parseResult.getErrors()).toHaveLength(0);
      }),
    );
  });

  it('should parse valid enums without errors', () => {
    // Property: Valid enum definitions should parse without errors
    fc.assert(
      fc.property(enumArbitrary, (source: string) => {
        const parseResult = parse(source);
        expect(parseResult.getErrors()).toHaveLength(0);
      }),
    );
  });

  it('should parse valid refs without errors', () => {
    // Property: Valid ref definitions should parse without errors
    fc.assert(
      fc.property(anyRefArbitrary, (source: string) => {
        const parseResult = parse(source);
        expect(parseResult.getErrors()).toHaveLength(0);
      }),
    );
  });

  it('should parse valid table groups without errors', () => {
    // Property: Valid table group definitions should parse without errors
    fc.assert(
      fc.property(tableGroupArbitrary, (source: string) => {
        const parseResult = parse(source);
        expect(parseResult.getErrors()).toHaveLength(0);
      }),
    );
  });

  it('should parse valid projects without errors', () => {
    // Property: Valid project definitions should parse without errors
    fc.assert(
      fc.property(projectArbitrary, (source: string) => {
        const parseResult = parse(source);
        expect(parseResult.getErrors()).toHaveLength(0);
      }),
    );
  });

  it('should parse valid standalone notes without errors', () => {
    // Property: Valid note definitions should parse without errors
    fc.assert(
      fc.property(standaloneNoteArbitrary, (source: string) => {
        const parseResult = parse(source);
        expect(parseResult.getErrors()).toHaveLength(0);
      }),
    );
  });

  it('should parse schemas without errors', () => {
    // Property: Valid schemas should parse without errors
    fc.assert(
      fc.property(smallSchemaArbitrary, (source: string) => {
        const parseResult = parse(source);
        expect(parseResult.getErrors()).toHaveLength(0);
      }),
    );
  });
});
