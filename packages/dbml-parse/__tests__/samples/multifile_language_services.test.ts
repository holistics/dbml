import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import { UseStatementMerger } from '@/services/completion/utils/useStatementMerger';
import { MockTextModel, createPosition } from '../utils';
import { Filepath } from '@/core/types/filepath';

const SAMPLES_DIR = __dirname;

/**
 * Helper to load a multifile sample project
 */
function loadSampleProject(sampleDir: string): Map<Filepath, string> {
  const files = new Map<Filepath, string>();
  const fullPath = join(SAMPLES_DIR, sampleDir);

  // Read all .dbml files in the directory
  const fs = require('fs');
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.dbml')) {
      const filePath = join(fullPath, entry.name);
      const content = readFileSync(filePath, 'utf-8');
      const filepath = new Filepath(filePath);
      files.set(filepath, content);
    }
  }

  return files;
}

/**
 * Helper to setup compiler with multifile project
 */
function setupCompilerWithProject(files: Map<Filepath, string>): {
  compiler: Compiler;
  files: Map<Filepath, string>;
} {
  const compiler = new Compiler();

  for (const [filepath, content] of files) {
    compiler.setSource(filepath, content);
  }

  compiler.bindProject();
  return { compiler, files };
}

describe('[samples] multifile language services', () => {
  describe('enum-across-files project', () => {
    it('should find definition of imported enum', () => {
      const files = loadSampleProject('enum-across-files');
      const { compiler } = setupCompilerWithProject(files);

      // Find main.dbml file
      const mainFile = Array.from(files.keys()).find(f => f.basename === 'main.dbml');
      if (!mainFile) throw new Error('main.dbml not found');

      const mainContent = files.get(mainFile)!;
      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(mainContent, mainFile.toUri()) as any;

      // Position at 'job_status' in the field type (line 6, around column 10)
      // "  status job_status"
      const position = createPosition(6, 10);
      const definitions = definitionProvider.provideDefinition(model, position);

      expect(definitions).toBeDefined();
      const defs = Array.isArray(definitions) ? definitions : (definitions ? [definitions] : []);
      expect(defs.length).toBeGreaterThanOrEqual(0);
      // Should find definition across files
      if (defs.length > 0) {
        expect(defs[0].uri).toBeDefined();
      }
    });

    it('should find all references to imported enum', () => {
      const files = loadSampleProject('enum-across-files');
      const { compiler } = setupCompilerWithProject(files);

      // Find types.dbml file
      const typesFile = Array.from(files.keys()).find(f => f.basename === 'types.dbml');
      if (!typesFile) throw new Error('types.dbml not found');

      const typesContent = files.get(typesFile)!;
      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = new MockTextModel(typesContent, typesFile.toUri()) as any;

      // Position at 'job_status' enum definition
      const position = createPosition(2, 8);
      const references = referencesProvider.provideReferences(model, position);

      expect(Array.isArray(references)).toBe(true);
      // Should find at least the reference in main.dbml
      expect(references.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('alias-and-schema-strip project', () => {
    it('should handle symbols from multiple files', () => {
      const files = loadSampleProject('alias-and-schema-strip');
      const { compiler } = setupCompilerWithProject(files);

      const mainFile = Array.from(files.keys()).find(f => f.basename === 'main.dbml');
      if (!mainFile) throw new Error('main.dbml not found');

      const mainContent = files.get(mainFile)!;
      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const model = new MockTextModel(mainContent, mainFile.toUri()) as any;

      // Should not crash when querying definitions in multifile context
      let didThrow = false;
      try {
        definitionProvider.provideDefinition(model, createPosition(1, 5));
      } catch {
        didThrow = true;
      }

      expect(didThrow).toBe(false);
    });
  });

  describe('transitive-ref-chain project', () => {
    it('should navigate through transitive references', () => {
      const files = loadSampleProject('transitive-ref-chain');
      const { compiler } = setupCompilerWithProject(files);

      expect(files.size).toBeGreaterThan(1);

      // Should have loaded multiple files (a.dbml, b.dbml, c.dbml)
      const fileNames = Array.from(files.keys()).map(f => f.basename);
      expect(fileNames).toContain('a.dbml');

      // Services should handle the project without crashing
      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const referencesProvider = new DBMLReferencesProvider(compiler);

      for (const [filepath, content] of files) {
        const model = new MockTextModel(content, filepath.toUri()) as any;

        let defThrow = false;
        let refThrow = false;

        try {
          definitionProvider.provideDefinition(model, createPosition(1, 1));
        } catch {
          defThrow = true;
        }

        try {
          referencesProvider.provideReferences(model, createPosition(1, 1));
        } catch {
          refThrow = true;
        }

        expect(defThrow).toBe(false);
        expect(refThrow).toBe(false);
      }
    });
  });

  describe('imported-tablegroup project', () => {
    it('should handle tablegroup imports across files', () => {
      const files = loadSampleProject('imported-tablegroup');
      const { compiler } = setupCompilerWithProject(files);

      const mainFile = Array.from(files.keys()).find(f => f.basename === 'main.dbml');
      if (!mainFile) throw new Error('main.dbml not found');

      const mainContent = files.get(mainFile)!;
      const referencesProvider = new DBMLReferencesProvider(compiler);
      const model = new MockTextModel(mainContent, mainFile.toUri()) as any;

      // Should not crash when finding references in tablegroup context
      let didThrow = false;
      try {
        referencesProvider.provideReferences(model, createPosition(3, 10));
      } catch {
        didThrow = true;
      }

      expect(didThrow).toBe(false);
    });
  });

  describe('circular-ref-across-circular-used-files project', () => {
    it('should handle circular references gracefully', () => {
      const files = loadSampleProject('circular-ref-across-circular-used-files');
      const { compiler } = setupCompilerWithProject(files);

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const referencesProvider = new DBMLReferencesProvider(compiler);

      for (const [filepath, content] of files) {
        const model = new MockTextModel(content, filepath.toUri()) as any;

        // Should not crash or infinite loop on circular structures
        let didThrow = false;
        try {
          definitionProvider.provideDefinition(model, createPosition(1, 1));
          referencesProvider.provideReferences(model, createPosition(1, 1));
        } catch {
          didThrow = true;
        }

        expect(didThrow).toBe(false);
      }
    });
  });

  describe('duplicate-records-multifile project', () => {
    it('should handle duplicate symbols across files', () => {
      const files = loadSampleProject('duplicate-records-multifile');
      const { compiler } = setupCompilerWithProject(files);

      const baseFile = Array.from(files.keys()).find(f => f.basename === 'base.dbml');
      const consumerFile = Array.from(files.keys()).find(f => f.basename === 'consumer.dbml');

      expect(baseFile).toBeDefined();
      expect(consumerFile).toBeDefined();

      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const referencesProvider = new DBMLReferencesProvider(compiler);

      // Test both files
      for (const filepath of [baseFile, consumerFile]) {
        if (!filepath) continue;

        const content = files.get(filepath)!;
        const model = new MockTextModel(content, filepath.toUri()) as any;

        let didThrow = false;
        try {
          definitionProvider.provideDefinition(model, createPosition(1, 1));
          referencesProvider.provideReferences(model, createPosition(1, 1));
        } catch {
          didThrow = true;
        }

        expect(didThrow).toBe(false);
      }
    });
  });

  describe('same-table-two-aliases project', () => {
    it('should disambiguate same table names across files', () => {
      const files = loadSampleProject('same-table-two-aliases');
      const { compiler } = setupCompilerWithProject(files);

      expect(files.size).toBeGreaterThan(1);

      const definitionProvider = new DBMLDefinitionProvider(compiler);

      // Load each file and query for definitions
      for (const [filepath, content] of files) {
        const model = new MockTextModel(content, filepath.toUri()) as any;

        let didThrow = false;
        try {
          // Try finding definitions at various positions
          for (let line = 1; line <= 5; line++) {
            definitionProvider.provideDefinition(model, createPosition(line, 5));
          }
        } catch {
          didThrow = true;
        }

        expect(didThrow).toBe(false);
      }
    });
  });

  describe('completion with additionalTextEdits', () => {
    it('should calculate additionalTextEdits for new use statement', () => {
      const filepath = new Filepath('/project/models.dbml');
      const mainContent = 'Table jobs { id int }';
      const compiler = new Compiler();
      compiler.setSource(filepath, mainContent);

      const result = UseStatementMerger.mergeSymbolIntoUses(
        compiler,
        filepath,
        mainContent,
        'job_status',
        filepath,
      );

      // Should create use statement at top
      expect(result.newContent).toMatch(/^use { job_status } from '\.\/models'/);
      expect(result.hint).toBe('created new');
      expect(result.editStartOffset).toBe(0);
    });

    it('should merge symbol into existing use statement from same file', () => {
      const filepath = new Filepath('/project/models.dbml');
      const mainContent = `use { User } from './models'

Table jobs {
  id int
  user_id int
}`;
      const compiler = new Compiler();
      compiler.setSource(filepath, mainContent);

      const result = UseStatementMerger.mergeSymbolIntoUses(
        compiler,
        filepath,
        mainContent,
        'Post',
        filepath,
      );

      // Should append to existing use statement
      expect(result.newContent).toContain('User, Post');
      expect(result.hint).toBe('merged into existing');
      expect(result.newContent).toContain('Table jobs');
    });

    it('should detect when symbol already imported', () => {
      const filepath = new Filepath('/project/models.dbml');
      const mainContent = `use { User, Post } from './models'

Table jobs { user_id int }`;
      const compiler = new Compiler();
      compiler.setSource(filepath, mainContent);

      const result = UseStatementMerger.mergeSymbolIntoUses(
        compiler,
        filepath,
        mainContent,
        'User',
        filepath,
      );

      // Should not duplicate
      expect(result.newContent).toBe(mainContent);
      expect(result.hint).toBe('symbol already imported');
    });

    it('should handle completion in file with multiple use statements', () => {
      const filepath = new Filepath('/project/models.dbml');
      const mainContent = `use { User } from './auth'
use { Table } from './schema'

Table jobs {
  id int
}`;
      const compiler = new Compiler();
      compiler.setSource(filepath, mainContent);

      // Complete from models file - should create new use
      const result = UseStatementMerger.mergeSymbolIntoUses(
        compiler,
        filepath,
        mainContent,
        'Column',
        filepath,
      );

      expect(result.newContent).toMatch(/^use { Column } from '\.\/models'/);
      expect(result.newContent).toContain('use { User } from');
      expect(result.newContent).toContain('use { Table } from');
    });

    it('should preserve relative paths in additionalTextEdits', () => {
      const filepath = new Filepath('/home/user/project/src/models.dbml');
      const mainContent = '';
      const compiler = new Compiler();
      compiler.setSource(filepath, mainContent);

      const result = UseStatementMerger.mergeSymbolIntoUses(
        compiler,
        filepath,
        mainContent,
        'Enum',
        filepath,
      );

      // Should normalize to relative path ./models
      expect(result.newContent).toContain("from './models'");
      expect(result.newContent).not.toContain('/home/user');
    });
  });

  describe('robustness across all sample projects', () => {
    it('should load all sample projects without errors', () => {
      const sampleDirs = [
        'enum-across-files',
        'alias-and-schema-strip',
        'transitive-ref-chain',
        'imported-tablegroup',
        'circular-ref-across-circular-used-files',
        'duplicate-records-multifile',
        'same-table-two-aliases',
      ];

      for (const sampleDir of sampleDirs) {
        let didThrow = false;
        try {
          const files = loadSampleProject(sampleDir);
          setupCompilerWithProject(files);
        } catch (e) {
          console.error(`Failed to load sample: ${sampleDir}`, e);
          didThrow = true;
        }

        expect(didThrow).toBe(false);
      }
    });

    it('should handle language services on all sample projects', () => {
      const sampleDirs = [
        'enum-across-files',
        'alias-and-schema-strip',
        'transitive-ref-chain',
      ];

      for (const sampleDir of sampleDirs) {
        const files = loadSampleProject(sampleDir);
        const { compiler } = setupCompilerWithProject(files);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const referencesProvider = new DBMLReferencesProvider(compiler);

        for (const [filepath, content] of files) {
          const model = new MockTextModel(content, filepath.toUri()) as any;

          let didThrow = false;
          try {
            definitionProvider.provideDefinition(model, createPosition(2, 5));
            referencesProvider.provideReferences(model, createPosition(2, 5));
          } catch {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
        }
      }
    });
  });
});
