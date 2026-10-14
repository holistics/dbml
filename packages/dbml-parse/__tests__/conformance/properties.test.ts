// Layer 1 conformance: property-based agreement between the spec grammar and
// the reference parser over the generators in __tests__/utils/arbitraries.
//
// Every generated source is parsed by both sides; they must agree on
// accept/reject and, when both accept, on the shape of the syntax tree.
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  anyRefArbitrary,
  binaryGarbageArbitrary,
  crlfSchemaArbitrary,
  dbmlSchemaArbitrary,
  enumArbitrary,
  malformedEnumArbitrary,
  malformedRefArbitrary,
  malformedTableArbitrary,
  mismatchedBracketsArbitrary,
  partialInjectionArbitrary,
  projectArbitrary,
  standaloneNoteArbitrary,
  tableArbitrary,
  tableGroupArbitrary,
  tablePartialArbitrary,
  tokenStreamArbitrary,
  truncatedInputArbitrary,
  unclosedBracketArbitrary,
  unclosedStringArbitrary,
} from '../utils/arbitraries';
import {
  type SpecParser,
  compare,
  describeComparison,
  loadSpecParsers,
} from './harness';

const SCHEMA_RUNS = 500;
const ELEMENT_RUNS = 100;
const MALFORMED_RUNS = 100;

function expectAgreement (parser: SpecParser, source: string): void {
  const result = compare(parser, source);
  expect(result.agreeOnVerdict, describeComparison(source, result)).toBe(true);
  if (result.agreeOnTree !== undefined) {
    expect(result.agreeOnTree, describeComparison(source, result)).toBe(true);
  }
}

const parsers = await loadSpecParsers();

describe.each(parsers)('[conformance] properties ($name)', (parser) => {
  it('agrees on whole schemas', {
    timeout: 300000,
  }, () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => expectAgreement(parser, source)),
      {
        numRuns: SCHEMA_RUNS,
      },
    );
  });

  it('agrees on schemas with CRLF line endings', () => {
    fc.assert(
      fc.property(crlfSchemaArbitrary, (source: string) => expectAgreement(parser, source)),
      {
        numRuns: ELEMENT_RUNS,
      },
    );
  });

  const elementArbitraries: [string, fc.Arbitrary<string>][] = [
    ['tables', tableArbitrary],
    ['enums', enumArbitrary],
    ['refs', anyRefArbitrary],
    ['table groups', tableGroupArbitrary],
    ['table partials', tablePartialArbitrary],
    ['partial injections', partialInjectionArbitrary],
    ['projects', projectArbitrary],
    ['standalone notes', standaloneNoteArbitrary],
  ];

  elementArbitraries.forEach(([name, arbitrary]) => {
    it(`agrees on ${name}`, () => {
      fc.assert(
        fc.property(arbitrary, (source: string) => expectAgreement(parser, source)),
        {
          numRuns: ELEMENT_RUNS,
        },
      );
    });
  });

  const malformedArbitraries: [string, fc.Arbitrary<string>][] = [
    ['malformed tables', malformedTableArbitrary],
    ['malformed enums', malformedEnumArbitrary],
    ['malformed refs', malformedRefArbitrary],
    ['unclosed brackets', unclosedBracketArbitrary],
    ['mismatched brackets', mismatchedBracketsArbitrary],
    ['unclosed strings', unclosedStringArbitrary],
    ['truncated input', truncatedInputArbitrary],
    ['binary garbage', binaryGarbageArbitrary],
    ['raw token streams', tokenStreamArbitrary],
  ];

  malformedArbitraries.forEach(([name, arbitrary]) => {
    it(`agrees on ${name}`, () => {
      fc.assert(
        fc.property(arbitrary, (source: string) => expectAgreement(parser, source)),
        {
          numRuns: MALFORMED_RUNS,
        },
      );
    });
  });
});
