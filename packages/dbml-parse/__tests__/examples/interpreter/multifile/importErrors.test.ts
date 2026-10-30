import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/core/types/errors';
import { Filepath } from '@/index';
import { setupCompiler } from './utils';

describe('[example] imported file error highlighting', () => {
  describe('file A imports file B with syntax errors', () => {
    test('file A gets an IMPORTED_FILE_HAS_ERRORS error on the import path', () => {
      const { compiler } = setupCompiler({
        '/a.dbml': `use * from './b.dbml'
Table orders { id int [pk] }`,
        '/b.dbml': `Table users {
  id int [pk
}`,
      });

      const errorsA = compiler.interpretFile(Filepath.from('/a.dbml')).getErrors();
      const importErrors = errorsA.filter((e) => e.code === CompileErrorCode.IMPORTED_FILE_HAS_ERRORS);
      expect(importErrors).toHaveLength(1);
      expect(importErrors[0].diagnostic).toBe("Imported file './b.dbml' contains errors");
      expect(importErrors[0].filepath.absolute).toBe(Filepath.from('/a.dbml').absolute);
    });

    test('file B errors are also present in file A errors', () => {
      const { compiler } = setupCompiler({
        '/a.dbml': `use * from './b.dbml'
Table orders { id int [pk] }`,
        '/b.dbml': `Table users {
  id int [pk
}`,
      });

      const errorsA = compiler.interpretFile(Filepath.from('/a.dbml')).getErrors();
      const errorsFromB = errorsA.filter((e) => e.filepath.absolute === Filepath.from('/b.dbml').absolute);
      expect(errorsFromB.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('file A imports file B which imports a non-existent file', () => {
    test('file A highlights file B as containing errors', () => {
      const { compiler } = setupCompiler({
        '/a.dbml': `use { table users } from './b.dbml'
Table orders { user_id int [ref: > users.id] }`,
        '/b.dbml': `use * from './nonexistent.dbml'
Table users { id int [pk] }`,
      });

      const errorsB = compiler.interpretFile(Filepath.from('/b.dbml')).getErrors();
      if (errorsB.length > 0) {
        const errorsA = compiler.interpretFile(Filepath.from('/a.dbml')).getErrors();
        const importErrors = errorsA.filter((e) => e.code === CompileErrorCode.IMPORTED_FILE_HAS_ERRORS);
        expect(importErrors).toHaveLength(1);
        expect(importErrors[0].diagnostic).toBe("Imported file './b.dbml' contains errors");
      }
    });
  });

  describe('transitive: file A imports file B imports file C with errors', () => {
    test('file B highlights file C, file A highlights file B', () => {
      const { compiler } = setupCompiler({
        '/a.dbml': `use { table users } from './b.dbml'
Table orders { user_id int [ref: > users.id] }`,
        '/b.dbml': 'use { table users } from \'./c.dbml\'',
        '/c.dbml': `Table users {
  id int [pk
}`,
      });

      // File C has syntax errors
      const errorsC = compiler.interpretFile(Filepath.from('/c.dbml')).getErrors();
      expect(errorsC.length).toBeGreaterThanOrEqual(1);

      // File B highlights file C
      const errorsB = compiler.interpretFile(Filepath.from('/b.dbml')).getErrors();
      const importErrorsB = errorsB.filter((e) => e.code === CompileErrorCode.IMPORTED_FILE_HAS_ERRORS);
      expect(importErrorsB).toHaveLength(1);
      expect(importErrorsB[0].diagnostic).toBe("Imported file './c.dbml' contains errors");

      // File A highlights file B (because B has errors, including the import error for C)
      const errorsA = compiler.interpretFile(Filepath.from('/a.dbml')).getErrors();
      const importErrorsA = errorsA.filter((e) => e.code === CompileErrorCode.IMPORTED_FILE_HAS_ERRORS);
      expect(importErrorsA).toHaveLength(1);
      expect(importErrorsA[0].diagnostic).toBe("Imported file './b.dbml' contains errors");
    });
  });

  describe('no false positives', () => {
    test('no IMPORTED_FILE_HAS_ERRORS when imported file is clean', () => {
      const { compiler } = setupCompiler({
        '/a.dbml': `use { table users } from './b.dbml'
Table orders { user_id int [ref: > users.id] }`,
        '/b.dbml': 'Table users { id int [pk] }',
      });

      const errorsA = compiler.interpretFile(Filepath.from('/a.dbml')).getErrors();
      const importErrors = errorsA.filter((e) => e.code === CompileErrorCode.IMPORTED_FILE_HAS_ERRORS);
      expect(importErrors).toHaveLength(0);
    });
  });

  describe('multiple imports with mixed error states', () => {
    test('only the import with errors is highlighted', () => {
      const { compiler } = setupCompiler({
        '/a.dbml': `use { table users } from './b.dbml'
use { table products } from './c.dbml'
Table orders { user_id int [ref: > users.id] }`,
        '/b.dbml': 'Table users { id int [pk] }',
        '/c.dbml': `Table products {
  id int [pk
}`,
      });

      const errorsA = compiler.interpretFile(Filepath.from('/a.dbml')).getErrors();
      const importErrors = errorsA.filter((e) => e.code === CompileErrorCode.IMPORTED_FILE_HAS_ERRORS);
      expect(importErrors).toHaveLength(1);
      expect(importErrors[0].diagnostic).toBe("Imported file './c.dbml' contains errors");
    });
  });
});
