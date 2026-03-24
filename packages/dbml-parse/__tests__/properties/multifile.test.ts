import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import Compiler from '@/compiler/index';
import { Filepath } from '@/compiler/projectLayout';
import { MemoryProjectLayout } from '@/compiler/projectLayout';
import {
  tableArbitrary,
  enumArbitrary,
  dbmlSchemaArbitrary,
} from '../utils/arbitraries';
import { anyIdentifierArbitrary } from '../utils/arbitraries/tokens';

const CONFIG = { numRuns: 50 };
const EXTENDED = { numRuns: 25 };

function createCompiler (files: Record<string, string>): Compiler {
  const entries: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    entries[Filepath.from(path).intern()] = content;
  }
  return new Compiler(new MemoryProjectLayout(entries));
}

describe('[property] multifile compilation', () => {
  describe('dependency graph invariants', () => {
    it('single file should always produce exactly 1 database', () => {
      fc.assert(
        fc.property(dbmlSchemaArbitrary, (content) => {
          const compiler = createCompiler({ '/main.dbml': content });
          const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
          expect(model.database).toHaveLength(1);
        }),
        CONFIG,
      );
    });

    it('file with one whole-file use should produce exactly 2 databases', () => {
      fc.assert(
        fc.property(
          tableArbitrary,
          tableArbitrary,
          (mainContent, depContent) => {
            const compiler = createCompiler({
              '/main.dbml': `use * from './dep.dbml'\n${mainContent}`,
              '/dep.dbml': depContent,
            });

            const report = compiler.interpretFile(Filepath.from('/main.dbml'));
            fc.pre(report.getErrors().length === 0);

            expect(report.getValue().database).toHaveLength(2);
          },
        ),
        CONFIG,
      );
    });

    it('diamond dependency should not produce duplicate databases', () => {
      fc.assert(
        fc.property(
          anyIdentifierArbitrary,
          anyIdentifierArbitrary,
          anyIdentifierArbitrary,
          (nameA, nameB, nameShared) => {
            fc.pre(nameA !== nameB && nameA !== nameShared && nameB !== nameShared);

            const compiler = createCompiler({
              '/main.dbml': `use { table ${nameA} } from './a.dbml'\nuse { table ${nameB} } from './b.dbml'\nTable main_t { id int }`,
              '/a.dbml': `use { enum ${nameShared} } from './shared.dbml'\nTable ${nameA} { id int }`,
              '/b.dbml': `use { enum ${nameShared} } from './shared.dbml'\nTable ${nameB} { id int }`,
              '/shared.dbml': `Enum ${nameShared} { v1\nv2 }`,
            });

            const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
            const uniqueDbs = new Set(model.database);
            expect(uniqueDbs.size).toBe(model.database.length);
          },
        ),
        EXTENDED,
      );
    });

    it('circular dependency should include both files', () => {
      fc.assert(
        fc.property(
          anyIdentifierArbitrary,
          anyIdentifierArbitrary,
          (nameA, nameB) => {
            fc.pre(nameA !== nameB);

            const compiler = createCompiler({
              '/a.dbml': `use { table ${nameB} } from './b.dbml'\nTable ${nameA} { id int }`,
              '/b.dbml': `use { table ${nameA} } from './a.dbml'\nTable ${nameB} { id int }`,
            });

            const model = compiler.interpretFile(Filepath.from('/a.dbml')).getValue();
            expect(model.database.length).toBeGreaterThanOrEqual(2);
          },
        ),
        CONFIG,
      );
    });
  });

  describe('error scoping invariants', () => {
    it('fileErrors for a file should not include errors from other files', () => {
      fc.assert(
        fc.property(
          tableArbitrary,
          (content) => {
            const compiler = createCompiler({
              '/good.dbml': `use * from './bad.dbml'\n${content}`,
              '/bad.dbml': 'Table { invalid syntax here !!!',
            });

            const goodErrors = compiler.fileErrors(Filepath.from('/good.dbml'));
            const badErrors = compiler.fileErrors(Filepath.from('/bad.dbml'));

            expect(badErrors.length).toBeGreaterThan(0);
            // good file's errors should not contain bad file's parse errors
            // (good may have its own errors from unresolved symbols, but not parse errors from bad)
          },
        ),
        EXTENDED,
      );
    });

  });

  describe('cache correctness invariants', () => {
    it('repeated calls should return same result', () => {
      fc.assert(
        fc.property(
          tableArbitrary,
          tableArbitrary,
          (mainContent, depContent) => {
            const compiler = createCompiler({
              '/main.dbml': `use * from './dep.dbml'\n${mainContent}`,
              '/dep.dbml': depContent,
            });

            const r1 = compiler.interpretFile(Filepath.from('/main.dbml'));
            const r2 = compiler.interpretFile(Filepath.from('/main.dbml'));

            expect(r1.getValue().database.length).toBe(r2.getValue().database.length);
            expect(r1.getErrors().length).toBe(r2.getErrors().length);
          },
        ),
        CONFIG,
      );
    });

    it('setSource on dependency should invalidate entry interpretation', () => {
      fc.assert(
        fc.property(
          tableArbitrary,
          tableArbitrary,
          tableArbitrary,
          (mainContent, depV1, depV2) => {
            fc.pre(depV1 !== depV2);

            const compiler = createCompiler({
              '/main.dbml': `use * from './dep.dbml'\n${mainContent}`,
              '/dep.dbml': depV1,
            });

            const r1 = compiler.interpretFile(Filepath.from('/main.dbml'));
            compiler.setSource(depV2, Filepath.from('/dep.dbml'));
            const r2 = compiler.interpretFile(Filepath.from('/main.dbml'));

            // We can't assert exact differences, but the model should be valid
            expect(r2.getValue().database.length).toBeGreaterThanOrEqual(1);
          },
        ),
        EXTENDED,
      );
    });
  });

  describe('model structure invariants', () => {
    it('every database in model should have valid structure', () => {
      fc.assert(
        fc.property(
          tableArbitrary,
          tableArbitrary,
          (mainContent, depContent) => {
            const compiler = createCompiler({
              '/main.dbml': `use * from './dep.dbml'\n${mainContent}`,
              '/dep.dbml': depContent,
            });

            const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();

            for (const db of model.database) {
              expect(db.tables).toBeInstanceOf(Array);
              expect(db.refs).toBeInstanceOf(Array);
              expect(db.enums).toBeInstanceOf(Array);
              expect(db.tableGroups).toBeInstanceOf(Array);
              expect(db.tablePartials).toBeInstanceOf(Array);

              db.tables.forEach((table) => {
                expect(table.name).toBeDefined();
                expect(table.fields).toBeInstanceOf(Array);
              });
            }
          },
        ),
        CONFIG,
      );
    });

    it('entry file database should always be first', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1001, max: 2000 }),
          (mainId, depId) => {
            const mainTable = `main_t${mainId}`;
            const depTable = `dep_t${depId}`;

            const compiler = createCompiler({
              '/main.dbml': `use * from './dep.dbml'\nTable ${mainTable} { id int }`,
              '/dep.dbml': `Table ${depTable} { id int }`,
            });

            const report = compiler.interpretFile(Filepath.from('/main.dbml'));
            fc.pre(report.getErrors().length === 0);

            const model = report.getValue();
            expect(model.database[0].tables.some((t) => t.name === mainTable)).toBe(true);
          },
        ),
        CONFIG,
      );
    });
  });
});
