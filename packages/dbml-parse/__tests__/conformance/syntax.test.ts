// Layer 1 conformance: the spec grammar and the reference parser must agree on
// every snapshot input in __tests__/snapshots/**/input/*.dbml.
//
// Disagreements are not silently tolerated. Each one is pinned below with the
// outcome of both sides and documented in spec/DISAGREEMENTS.md. If either
// side changes behaviour, the pinned expectation fails and the entry has to be
// revisited.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type Verdict,
  compare,
  describeComparison,
  loadSpecParsers,
} from './harness';

interface KnownDisagreement {
  reference: Verdict;
  spec: Verdict;
  // Entry in spec/DISAGREEMENTS.md
  see: string;
}

// Snapshot inputs that disagree, keyed by `<snapshot dir>/<test name>`.
const KNOWN_DISAGREEMENTS: Record<string, KnownDisagreement> = {
  'parser/last_invalid_number': {
    reference: 'reject',
    spec: 'accept',
    see: 'D1',
  },
};

// Inline inputs for the disagreements that the snapshot corpus does not reach.
// `treesAgree: false` pins a case where both sides accept but build different
// trees.
const PINNED_DISAGREEMENTS: (KnownDisagreement & { source: string; treesAgree?: boolean })[] = [
  {
    see: 'D1',
    source: 'Note: 12.',
    reference: 'reject',
    spec: 'accept',
  },
  {
    see: 'D2',
    source: 'Note: 1a',
    reference: 'accept',
    spec: 'accept',
    treesAgree: false,
  },
  {
    see: 'D3',
    source: 'Note: 1.a',
    reference: 'accept',
    spec: 'reject',
  },
  {
    see: 'D4',
    source: "Note: '\\uzzzz'",
    reference: 'accept',
    spec: 'reject',
  },
  {
    see: 'D5',
    source: 'Table \u{2000B} { id int }',
    reference: 'reject',
    spec: 'accept',
  },
];

// Behaviour that both sides share and that spec/DISAGREEMENTS.md calls out as
// surprising. Pinned so that the description stays truthful.
const AGREED_QUIRKS: [string, string][] = [
  ['operator continues previous line', 'Table t {\n  (a, b) [pk]\n  -2()\n}'],
  ['index across a line break', 'Table t {\n  a int\n[note: 1]\n}'],
  ['trailing space defeats index across a line break', 'Table t {\n  a int \n[note: 1]\n}'],
  ['semicolon is never valid', 'Table t { id int; }'],
  ['comment alone does not separate arguments', 'Table t { a/**/int }'],
  ['comment with space separates arguments', 'Table t { a /**/int }'],
  ['carriage return does not separate arguments', 'Table t { a\rint }'],
  ['non-hex colour literal', 'Table t [headercolor: #zzz] { id int }'],
  ['bare colour literal', 'Table t [headercolor: #] { id int }'],
  ['use never falls back to an element', 'use x {}'],
  ['simple body swallows the line', "Note: 'x' Table y {}"],
  ['trailing-dot number mid-file', 'Note: 12.\n'],
  ['digit-leading identifier mid-file', 'Note: 1a\n'],
  ['BMP letters in identifiers', 'Table \u65E5\u672C { id int }'],
];

const SNAPSHOT_ROOT = path.resolve(__dirname, '../snapshots');

function listInputs (): { key: string; file: string }[] {
  return readdirSync(SNAPSHOT_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((dir) => {
      const inputDir = path.join(SNAPSHOT_ROOT, dir.name, 'input');
      return readdirSync(inputDir)
        .filter((f) => f.endsWith('.in.dbml'))
        .map((f) => ({
          key: `${dir.name}/${f.replace(/\.in\.dbml$/, '')}`,
          file: path.join(inputDir, f),
        }));
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

const parsers = await loadSpecParsers();

describe.each(parsers)('[conformance] syntax ($name)', (parser) => {
  const inputs = listInputs();

  it('covers every snapshot input', () => {
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('pins only disagreements that still have an input file', () => {
    const keys = new Set(inputs.map((i) => i.key));
    Object.keys(KNOWN_DISAGREEMENTS).forEach((key) => expect(keys.has(key), key).toBe(true));
  });

  inputs.forEach(({ key, file }) => {
    it(key, () => {
      const source = readFileSync(file, 'utf-8');
      const result = compare(parser, source);
      const known = KNOWN_DISAGREEMENTS[key];

      if (known) {
        expect(result.reference.verdict, `reference verdict changed; see DISAGREEMENTS.md ${known.see}\n${describeComparison(source, result)}`).toBe(known.reference);
        expect(result.spec.verdict, `spec verdict changed; see DISAGREEMENTS.md ${known.see}\n${describeComparison(source, result)}`).toBe(known.spec);
        return;
      }

      expect(result.agreeOnVerdict, describeComparison(source, result)).toBe(true);
      if (result.agreeOnTree !== undefined) {
        expect(result.agreeOnTree, describeComparison(source, result)).toBe(true);
      }
    });
  });
});

describe.each(parsers)('[conformance] recorded disagreements ($name)', (parser) => {
  PINNED_DISAGREEMENTS.forEach((pinned) => {
    it(`${pinned.see}: ${JSON.stringify(pinned.source)}`, () => {
      const result = compare(parser, pinned.source);
      const message = `behaviour changed; revisit DISAGREEMENTS.md ${pinned.see}\n${describeComparison(pinned.source, result)}`;
      expect(result.reference.verdict, message).toBe(pinned.reference);
      expect(result.spec.verdict, message).toBe(pinned.spec);
      if (pinned.treesAgree !== undefined) {
        expect(result.agreeOnTree, message).toBe(pinned.treesAgree);
      }
    });
  });

  AGREED_QUIRKS.forEach(([name, source]) => {
    it(`agreed: ${name}`, () => {
      const result = compare(parser, source);
      expect(result.agreeOnVerdict, describeComparison(source, result)).toBe(true);
      if (result.agreeOnTree !== undefined) {
        expect(result.agreeOnTree, describeComparison(source, result)).toBe(true);
      }
    });
  });
});
