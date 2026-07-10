import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { SymbolKind, MetadataTargetKind } from '@/core/types/symbol';
import { mapNamePartToSymbolKind } from '@/core/global_modules/metadata/resolve';

const PROPERTY_TEST_CONFIG = {
  numRuns: 200,
};

const TERMINAL_KIND: Record<MetadataTargetKind, SymbolKind> = {
  [MetadataTargetKind.Table]: SymbolKind.Table,
  [MetadataTargetKind.Column]: SymbolKind.Column,
  [MetadataTargetKind.TableGroup]: SymbolKind.TableGroup,
  [MetadataTargetKind.Note]: SymbolKind.StickyNote,
};

const targetKindArbitrary = fc.constantFrom(...Object.values(MetadataTargetKind));

// Bias generation toward the schema name and short arrays: those exercise the
// Column single-part branch and the `public` handling downstream.
const namePartArbitrary = fc.oneof(
  { weight: 3, arbitrary: fc.constant(DEFAULT_SCHEMA_NAME) },
  { weight: 1, arbitrary: fc.string({ minLength: 1, maxLength: 8 }) },
);
const namePartsArbitrary = fc.array(namePartArbitrary, { minLength: 1, maxLength: 6 });

describe('[property] mapNamePartToSymbolKind', () => {
  it('preserves the number of name parts', () => {
    fc.assert(
      fc.property(namePartsArbitrary, targetKindArbitrary, (nameParts, targetKind) => {
        expect(mapNamePartToSymbolKind(nameParts, targetKind)).toHaveLength(nameParts.length);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('preserves name order and values', () => {
    fc.assert(
      fc.property(namePartsArbitrary, targetKindArbitrary, (nameParts, targetKind) => {
        const res = mapNamePartToSymbolKind(nameParts, targetKind);
        expect(res.map((r) => r.name)).toEqual(nameParts);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('maps the last part to the target-specific terminal kind', () => {
    fc.assert(
      fc.property(namePartsArbitrary, targetKindArbitrary, (nameParts, targetKind) => {
        const res = mapNamePartToSymbolKind(nameParts, targetKind);
        expect(res[res.length - 1].symbolKind).toBe(TERMINAL_KIND[targetKind]);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('maps every non-terminal part to Schema, except for Column: second last is Table', () => {
    fc.assert(
      fc.property(namePartsArbitrary, targetKindArbitrary, (nameParts, targetKind) => {
        const res = mapNamePartToSymbolKind(nameParts, targetKind);
        const lastIdx = res.length - 1;

        res.forEach((part, idx) => {
          if (idx === lastIdx) return; // terminal kind checked elsewhere

          if (targetKind === MetadataTargetKind.Column && idx === lastIdx - 1) {
            expect(part.symbolKind).toBe(SymbolKind.Table);
          } else {
            expect(part.symbolKind).toBe(SymbolKind.Schema);
          }
        });
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('assigns a defined SymbolKind to every part', () => {
    // Guards the positional `kindParts[idx]` indexing against length mismatches.
    fc.assert(
      fc.property(namePartsArbitrary, targetKindArbitrary, (nameParts, targetKind) => {
        const res = mapNamePartToSymbolKind(nameParts, targetKind);
        res.forEach((part) => expect(part.symbolKind).toBeDefined());
      }),
      PROPERTY_TEST_CONFIG,
    );
  });
});
