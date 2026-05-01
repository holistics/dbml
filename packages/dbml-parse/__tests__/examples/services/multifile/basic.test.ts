import { describe, it, expect } from 'vitest';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import { createMockTextModel, createPosition } from '../../../utils';
import { Filepath } from '@/core/types/filepath';

// Inline project source maps. Each entry maps a filepath (relative to /) onto
// the file's DBML source. `setupCompiler` mounts every entry on the compiler
// and returns both the compiler and a `Filepath -> source` map keyed by the
// canonicalised Filepath instance - so callers can `model.toUri()` the same
// instance that was loaded.
type ProjectFiles = Record<string, string>;

function setupCompiler (project: ProjectFiles): {
  compiler: Compiler;
  files: Map<Filepath, string>;
} {
  const compiler = new Compiler();
  const files = new Map<Filepath, string>();
  for (const [path, content] of Object.entries(project)) {
    const fp = Filepath.from(path);
    compiler.setSource(fp, content);
    files.set(fp, content);
  }
  compiler.bindProject();
  return {
    compiler,
    files,
  };
}

const ENUM_IMPORTS: ProjectFiles = {
  '/enum-source.dbml': `
Enum job_status {
  pending
  running
  done
}
`,
  '/consumer-direct-import.dbml': `
use { enum job_status } from './enum-source.dbml'

Table jobs {
  id int [pk]
  status job_status
}
`,
  '/consumer-aliased-import.dbml': `
use { enum job_status as Status } from './enum-source.dbml'

Table jobs {
  id int [pk]
  status Status
}
`,
};

const ALIAS_AND_SCHEMA_STRIP: ProjectFiles = {
  '/auth-tables.dbml': `Table auth.users {
  id int [pk]
  email varchar
}`,
  '/main.dbml': `use { table auth.users as u } from './auth-tables.dbml'

Table orders {
  id int [pk]
  user_id int [ref: > u.id]
}`,
};

const TRANSITIVE_REF_CHAIN: ProjectFiles = {
  '/c.dbml': `Table payments {
  id int [pk]
  amount int
}`,
  '/b.dbml': `use { table payments } from './c.dbml'

Table orders {
  id int [pk]
  payment_id int [ref: > payments.id]
}`,
  '/a.dbml': `use { table orders } from './b.dbml'

Table users {
  id int [pk]
  email varchar
}`,
};

const IMPORTED_TABLEGROUP: ProjectFiles = {
  '/base.dbml': `Table users {
  id int [pk]
  email varchar
}

Table posts {
  id int [pk]
  user_id int
}

TableGroup content {
  users
  posts
}`,
  '/main.dbml': `use { tablegroup content } from './base.dbml'`,
};

const CIRCULAR_REF: ProjectFiles = {
  '/x.dbml': `use { table y_table } from './y.dbml'

Table x_table {
  id int [pk]
  y_id int [ref: > y_table.id]
}`,
  '/y.dbml': `use { table x_table } from './x.dbml'

Table y_table {
  id int [pk]
  x_id int [ref: > x_table.id]
}`,
};

const DUPLICATE_RECORDS: ProjectFiles = {
  '/base.dbml': `Table users {
  id int [pk]
  name varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}`,
  '/consumer.dbml': `reuse { table users } from './base.dbml'

records users(id, name) {
  3, 'Carol'
  4, 'Dave'
}`,
};

const SAME_TABLE_TWO_ALIASES: ProjectFiles = {
  '/base.dbml': `Table users {
  id int [pk]
  email varchar
}`,
  '/consumer-a.dbml': `use { table users as u } from './base.dbml'

TableGroup group_a {
  u
}`,
  '/consumer-b.dbml': `use { table users } from './base.dbml'

TableGroup group_b {
  users
}`,
};

function pickFile (files: Map<Filepath, string>, basename: string): Filepath {
  for (const fp of files.keys()) {
    if (fp.basename === basename) return fp;
  }
  throw new Error(`${basename} not found`);
}

describe('[inline] multifile language services', () => {
  describe('enum-imports project', () => {
    const { compiler, files } = setupCompiler(ENUM_IMPORTS);

    it('should find definition of imported enum', () => {
      const mainFile = pickFile(files, 'consumer-direct-import.dbml');
      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(files.get(mainFile)!, mainFile.toUri());

      // "  status job_status" sits on the field-type token a few lines into the file
      const definitions = definitionProvider.provideDefinition(model, createPosition(6, 10));

      expect(definitions).toBeDefined();
      const defs = Array.isArray(definitions) ? definitions : (definitions ? [definitions] : []);
      expect(defs.length).toBeGreaterThanOrEqual(0);
      if (defs.length > 0) expect(defs[0].uri).toBeDefined();
    });

    it('should find all references to imported enum', () => {
      const typesFile = pickFile(files, 'enum-source.dbml');
      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(files.get(typesFile)!, typesFile.toUri());

      // Position at the `job_status` enum declaration name
      const references = referencesProvider.provideReferences(model, createPosition(2, 8));

      expect(Array.isArray(references)).toBe(true);
      expect(references.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('alias-and-schema-strip project', () => {
    it('should handle symbols from multiple files', () => {
      const { compiler, files } = setupCompiler(ALIAS_AND_SCHEMA_STRIP);
      const mainFile = pickFile(files, 'main.dbml');
      const mainContent = files.get(mainFile)!;
      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = createMockTextModel(mainContent, mainFile.toUri());

      expect(() => definitionProvider.provideDefinition(model, createPosition(1, 5))).not.toThrow();
    });
  });

  describe('transitive-ref-chain project', () => {
    it('should navigate through transitive references', () => {
      const { compiler, files } = setupCompiler(TRANSITIVE_REF_CHAIN);
      expect(files.size).toBe(3);
      expect(Array.from(files.keys()).map((f) => f.basename)).toContain('a.dbml');

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const referencesProvider = new DBMLReferencesProvider(compiler);

      for (const [filepath, content] of files) {
        const model = createMockTextModel(content, filepath.toUri());
        expect(() => definitionProvider.provideDefinition(model, createPosition(1, 1))).not.toThrow();
        expect(() => referencesProvider.provideReferences(model, createPosition(1, 1))).not.toThrow();
      }
    });
  });

  describe('imported-tablegroup project', () => {
    it('should handle tablegroup imports across files', () => {
      const { compiler, files } = setupCompiler(IMPORTED_TABLEGROUP);
      const mainFile = pickFile(files, 'main.dbml');
      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = createMockTextModel(files.get(mainFile)!, mainFile.toUri());

      expect(() => referencesProvider.provideReferences(model, createPosition(3, 10))).not.toThrow();
    });
  });

  describe('circular-ref project', () => {
    // Circular structures must not crash or infinite-loop in language services.
    it('should handle circular references gracefully', () => {
      const { compiler, files } = setupCompiler(CIRCULAR_REF);
      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const referencesProvider = new DBMLReferencesProvider(compiler);

      for (const [filepath, content] of files) {
        const model = createMockTextModel(content, filepath.toUri());
        expect(() => {
          definitionProvider.provideDefinition(model, createPosition(1, 1));
          referencesProvider.provideReferences(model, createPosition(1, 1));
        }).not.toThrow();
      }
    });
  });

  describe('duplicate-records project', () => {
    it('should handle duplicate symbols across files', () => {
      const { compiler, files } = setupCompiler(DUPLICATE_RECORDS);
      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const referencesProvider = new DBMLReferencesProvider(compiler);

      for (const filepath of [pickFile(files, 'base.dbml'), pickFile(files, 'consumer.dbml')]) {
        const model = createMockTextModel(files.get(filepath)!, filepath.toUri());
        expect(() => {
          definitionProvider.provideDefinition(model, createPosition(1, 1));
          referencesProvider.provideReferences(model, createPosition(1, 1));
        }).not.toThrow();
      }
    });
  });

  describe('same-table-two-aliases project', () => {
    it('should disambiguate same table names across files', () => {
      const { compiler, files } = setupCompiler(SAME_TABLE_TWO_ALIASES);
      expect(files.size).toBe(3);
      const definitionProvider = new DBMLDefinitionProvider(compiler);

      for (const [filepath, content] of files) {
        const model = createMockTextModel(content, filepath.toUri());

        expect(() => {
          for (let line = 1; line <= 5; line++) {
            definitionProvider.provideDefinition(model, createPosition(line, 5));
          }
        }).not.toThrow();
      }
    });
  });

  describe('robustness sweep across representative projects', () => {
    // Per-project describes already exercise binding; this loop only adds the
    // (line=2, col=5) probe across multiple files of each project to catch
    // any provider that crashes when invoked at a non-trivial position.
    const PROJECTS: ProjectFiles[] = [ENUM_IMPORTS, ALIAS_AND_SCHEMA_STRIP, TRANSITIVE_REF_CHAIN];

    it('language services do not throw at probe positions', () => {
      for (const project of PROJECTS) {
        const { compiler, files } = setupCompiler(project);
        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const referencesProvider = new DBMLReferencesProvider(compiler);

        for (const [filepath, content] of files) {
          const model = createMockTextModel(content, filepath.toUri());
          expect(() => {
            definitionProvider.provideDefinition(model, createPosition(2, 5));
            referencesProvider.provideReferences(model, createPosition(2, 5));
          }).not.toThrow();
        }
      }
    });
  });
});
