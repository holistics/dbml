import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import Compiler from '@/compiler/index';
import { Filepath } from '@/compiler/projectLayout';
import { MemoryProjectLayout } from '@/compiler/projectLayout';
import {
  useDeclarationArbitrary,
  dbmlSchemaArbitrary,
  tableArbitrary,
  enumArbitrary,
} from '../utils/arbitraries';
import { anyIdentifierArbitrary } from '../utils/arbitraries/tokens';

const FUZZ_CONFIG = { numRuns: 50 };
const ROBUSTNESS_CONFIG = { numRuns: 25 };

function createCompiler (files: Record<string, string>): Compiler {
  const entries: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    entries[Filepath.from(path).intern()] = content;
  }
  return new Compiler(new MemoryProjectLayout(entries));
}

describe('[fuzz] multifile - interpretFile never throws', () => {
  it('should not throw on two arbitrary DBML files with selective use', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        tableArbitrary,
        anyIdentifierArbitrary,
        (mainContent, depContent, tableName) => {
          const compiler = createCompiler({
            '/main.dbml': `use { table ${tableName} } from './dep.dbml'\n${mainContent}`,
            '/dep.dbml': depContent,
          });

          const report = compiler.interpretFile(Filepath.from('/main.dbml'));
          expect(report).toBeDefined();
          expect(report.getValue()).toBeDefined();
          expect(report.getValue().database).toBeInstanceOf(Array);
          expect(report.getErrors()).toBeInstanceOf(Array);
        },
      ),
      FUZZ_CONFIG,
    );
  });

  it('should not throw on two arbitrary DBML files with whole-file use', () => {
    fc.assert(
      fc.property(
        dbmlSchemaArbitrary,
        dbmlSchemaArbitrary,
        (mainContent, depContent) => {
          const compiler = createCompiler({
            '/main.dbml': `use * from './dep.dbml'\n${mainContent}`,
            '/dep.dbml': depContent,
          });

          const report = compiler.interpretFile(Filepath.from('/main.dbml'));
          expect(report).toBeDefined();
          expect(report.getValue().database.length).toBeGreaterThanOrEqual(1);
        },
      ),
      FUZZ_CONFIG,
    );
  });

  it('should not throw on circular dependencies', () => {
    fc.assert(
      fc.property(
        anyIdentifierArbitrary,
        anyIdentifierArbitrary,
        (name1, name2) => {
          fc.pre(name1 !== name2);
          const compiler = createCompiler({
            '/a.dbml': `use { table ${name2} } from './b.dbml'\nTable ${name1} { id int }`,
            '/b.dbml': `use { table ${name1} } from './a.dbml'\nTable ${name2} { id int }`,
          });

          const report = compiler.interpretFile(Filepath.from('/a.dbml'));
          expect(report).toBeDefined();
          expect(report.getValue().database).toBeInstanceOf(Array);
        },
      ),
      FUZZ_CONFIG,
    );
  });

  it('should not throw on missing dependency file', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        anyIdentifierArbitrary,
        (content, tableName) => {
          const compiler = createCompiler({
            '/main.dbml': `use { table ${tableName} } from './missing.dbml'\n${content}`,
          });

          const report = compiler.interpretFile(Filepath.from('/main.dbml'));
          expect(report).toBeDefined();
          expect(report.getValue().database).toBeDefined();
        },
      ),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should not throw on arbitrary string as dependency', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        fc.string().filter((s) => !s.includes('\0')),
        (mainContent, depContent) => {
          const compiler = createCompiler({
            '/main.dbml': `use * from './dep.dbml'\n${mainContent}`,
            '/dep.dbml': depContent,
          });

          const report = compiler.interpretFile(Filepath.from('/main.dbml'));
          expect(report).toBeDefined();
          expect(report.getValue().database).toBeInstanceOf(Array);
        },
      ),
      ROBUSTNESS_CONFIG,
    );
  });
});

describe('[fuzz] multifile - model structure invariants', () => {
  it('should always have at least one database in model', () => {
    fc.assert(
      fc.property(
        dbmlSchemaArbitrary,
        (content) => {
          const compiler = createCompiler({ '/main.dbml': content });
          const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
          expect(model.database.length).toBeGreaterThanOrEqual(1);
        },
      ),
      FUZZ_CONFIG,
    );
  });

  it('should have database count >= 1 + number of use declarations', () => {
    fc.assert(
      fc.property(
        fc.array(tableArbitrary, { minLength: 1, maxLength: 3 }),
        (depContents) => {
          const depFiles: Record<string, string> = {};
          const useStatements: string[] = [];
          depContents.forEach((content, i) => {
            depFiles[`/dep${i}.dbml`] = content;
            useStatements.push(`use * from './dep${i}.dbml'`);
          });

          const compiler = createCompiler({
            '/main.dbml': `${useStatements.join('\n')}\nTable main_t { id int }`,
            ...depFiles,
          });

          const model = compiler.interpretFile(Filepath.from('/main.dbml')).getValue();
          // At least entry file + each dep
          expect(model.database.length).toBeGreaterThanOrEqual(1 + depContents.length);
        },
      ),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should produce consistent results on repeated interpretation', () => {
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
      FUZZ_CONFIG,
    );
  });
});

describe('[fuzz] multifile - error handling', () => {
  it('fileErrors should always return an array', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('\0')),
        fc.string().filter((s) => !s.includes('\0')),
        (mainContent, depContent) => {
          const compiler = createCompiler({
            '/main.dbml': `use * from './dep.dbml'\n${mainContent}`,
            '/dep.dbml': depContent,
          });

          const errors = compiler.fileErrors(Filepath.from('/main.dbml'));
          expect(errors).toBeInstanceOf(Array);
          errors.forEach((error) => {
            expect(error.diagnostic.length).toBeGreaterThan(0);
          });
        },
      ),
      ROBUSTNESS_CONFIG,
    );
  });

});
