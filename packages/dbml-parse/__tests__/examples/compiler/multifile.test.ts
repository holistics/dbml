import { describe, expect, test } from 'vitest';
import { Compiler } from '@/index';
import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/constants';

const fileA = Filepath.create('/project/a.dbml');
const fileB = Filepath.create('/project/b.dbml');

describe('[example] multi-file compiler', () => {
  describe('source management', () => {
    test('should set and get source for multiple files', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');
      compiler.setSource(fileB, 'Table posts { id int }');

      expect(compiler.layout.getSource(fileA)).toBe('Table users { id int }');
      expect(compiler.layout.getSource(fileB)).toBe('Table posts { id int }');
    });

    test('should delete source for a file', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');
      compiler.deleteSource(fileA);

      expect(compiler.layout.getSource(fileA)).toBeUndefined();
    });

    test('should clear all sources', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');
      compiler.setSource(fileB, 'Table posts { id int }');
      compiler.clearSource();

      expect(compiler.layout.getSource(fileA)).toBeUndefined();
      expect(compiler.layout.getSource(fileB)).toBeUndefined();
    });
  });

  describe('per-file parsing', () => {
    test('should parse each file independently', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');
      compiler.setSource(fileB, 'Table posts { id int }');

      const resultA = compiler.parseFile(fileA);
      const resultB = compiler.parseFile(fileB);

      expect(resultA.getErrors()).toHaveLength(0);
      expect(resultB.getErrors()).toHaveLength(0);

      const astA = resultA.getValue().ast;
      const astB = resultB.getValue().ast;

      expect(astA.declarations).toHaveLength(1);
      expect(astB.declarations).toHaveLength(1);
      expect(astA.filepath).toBe(fileA);
      expect(astB.filepath).toBe(fileB);
    });

    test('should parse file with use declarations', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');
      compiler.setSource(fileB, `
        use { table users } from './a.dbml'
        Table posts { user_id int }
      `);

      const result = compiler.parseFile(fileB);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue().ast;
      expect(ast.uses).toHaveLength(1);
      expect(ast.declarations).toHaveLength(1);
    });

    test('should cache parse results', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');

      const result1 = compiler.parseFile(fileA);
      const result2 = compiler.parseFile(fileA);

      // Same cached result
      expect(result1).toBe(result2);
    });

    test('should invalidate cache on setSource', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');

      const result1 = compiler.parseFile(fileA);
      compiler.setSource(fileA, 'Table users { id int\n name varchar }');
      const result2 = compiler.parseFile(fileA);

      expect(result1).not.toBe(result2);
    });
  });

  describe('file dependencies', () => {
    test('should detect dependencies from use declarations', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');
      compiler.setSource(fileB, `use { table users } from './a.dbml'`);

      const deps = compiler.fileDependencies(fileB);
      expect(deps.size).toBe(1);
    });

    test('should return empty for file without use declarations', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');

      const deps = compiler.fileDependencies(fileA);
      expect(deps.size).toBe(0);
    });
  });

  describe('node filepath', () => {
    test('should attach filepath to AST nodes', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');

      const ast = compiler.parseFile(fileA).getValue().ast;
      expect(ast.filepath).toBe(fileA);
      expect(ast.declarations[0].filepath).toBe(fileA);
    });

    test('should attach filepath to tokens', () => {
      const compiler = new Compiler();
      compiler.setSource(fileA, 'Table users { id int }');

      const tokens = compiler.parseFile(fileA).getValue().tokens;
      expect(tokens[0].filepath).toBe(fileA);
    });
  });
});
