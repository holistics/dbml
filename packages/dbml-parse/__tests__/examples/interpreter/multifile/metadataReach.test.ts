import { describe, expect, test } from 'vitest';
import type { Database } from '@/index';
import { CompileErrorCode } from '@/index';
import { fp, getDatabase, setupCompiler } from './utils';

// A Metadata block applies in program P only when P reaches the block's file and the block's Target is visible from P.
// P is /p.dbml. Each case places the same block in a different file and checks P's own output.
const BASE = `
Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int
}
TableGroup g {
  users
}
Note n {
  'hello'
}
Ref r: posts.user_id > users.id
`;

interface TargetCase {
  kind: string;
  header: string;
  metadataOf: (db: Database) => Record<string, string> | undefined;
}

const TARGETS: TargetCase[] = [
  { kind: 'Table', header: 'Metadata Table users', metadataOf: (db) => db.tables.find((t) => t.name === 'users')?.metadata },
  { kind: 'Column', header: 'Metadata Column users.id', metadataOf: (db) => db.tables.find((t) => t.name === 'users')?.fields.find((f) => f.name === 'id')?.metadata },
  { kind: 'TableGroup', header: 'Metadata TableGroup g', metadataOf: (db) => db.tableGroups.find((g) => g.name === 'g')?.metadata },
  { kind: 'Note', header: 'Metadata Note n', metadataOf: (db) => db.notes.find((n) => n.name === 'n')?.metadata },
  { kind: 'Ref', header: 'Metadata Ref r', metadataOf: (db) => db.refs.find((r) => r.name === 'r')?.metadata },
];

const block = (header: string) => `${header} {\n  owner: 'x'\n}\n`;
const USE_BASE = "use * from './base.dbml'\n";

interface Placement {
  name: string;
  applied: boolean;
  files: (header: string) => Record<string, string>;
}

const PLACEMENTS: Placement[] = [
  {
    name: "P's own file",
    applied: true,
    files: (header) => ({
      '/base.dbml': BASE,
      '/p.dbml': `${USE_BASE}${block(header)}`,
    }),
  },
  {
    name: 'a file P imports',
    applied: true,
    files: (header) => ({
      '/base.dbml': BASE,
      '/meta.dbml': `${USE_BASE}${block(header)}`,
      '/p.dbml': `${USE_BASE}use * from './meta.dbml'\n`,
    }),
  },
  {
    name: 'a file importing P',
    applied: false,
    files: (header) => ({
      '/base.dbml': BASE,
      '/p.dbml': USE_BASE,
      '/importer.dbml': `${USE_BASE}use * from './p.dbml'\n${block(header)}`,
    }),
  },
  {
    name: 'an unrelated file',
    applied: false,
    files: (header) => ({
      '/base.dbml': BASE,
      '/p.dbml': USE_BASE,
      '/other.dbml': `${USE_BASE}${block(header)}`,
    }),
  },
];

describe('[example] multifile interpreter - Metadata reach', () => {
  for (const target of TARGETS) {
    describe(`${target.kind} target`, () => {
      for (const placement of PLACEMENTS) {
        test(`block in ${placement.name} ${placement.applied ? 'applies' : 'does not apply'}`, () => {
          const { compiler } = setupCompiler(placement.files(target.header));
          const metadata = target.metadataOf(getDatabase(compiler, '/p.dbml'));
          expect(metadata ?? {}).toEqual(placement.applied ? { owner: 'x' } : {});
        });
      }
    });
  }

  test('a missing target reports a binding error', () => {
    const { compiler } = setupCompiler({
      '/base.dbml': BASE,
      '/p.dbml': `${USE_BASE}${block('Metadata Table nope')}`,
    });

    const result = compiler.interpretFile(fp('/p.dbml'));
    expect(result.getErrors().map((e) => e.code)).toContain(CompileErrorCode.BINDING_ERROR);
    expect(result.getErrors().map((e) => e.diagnostic)).toContain('Cannot find metadata target element: `Table nope`');
  });

  test('an ambiguous Ref target reports a binding error', () => {
    const { compiler } = setupCompiler({
      '/base.dbml': BASE,
      '/dup.dbml': `${USE_BASE}Ref r: posts.id > users.id\n`,
      '/p.dbml': `${USE_BASE}use * from './dup.dbml'\n${block('Metadata Ref r')}`,
    });

    const result = compiler.interpretFile(fp('/p.dbml'));
    expect(result.getErrors().map((e) => e.code)).toContain(CompileErrorCode.BINDING_ERROR);
    expect(result.getErrors().map((e) => e.diagnostic)).toContain("Ref 'r' is ambiguous: it has multiple definitions");
  });
});
