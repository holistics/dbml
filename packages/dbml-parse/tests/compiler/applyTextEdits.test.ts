import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler/index';
import { applyTextEdits } from '@/compiler/queries/transform/applyTextEdits';

describe('@dbml/parse - applyTextEdits', () => {
  describe('standalone function', () => {
    test('should apply a single edit', () => {
      const source = 'Hello world';
      const result = applyTextEdits(source, [
        { start: 0, end: 5, newText: 'Hi' },
      ]);
      expect(result).toBe('Hi world');
    });

    test('should apply multiple non-overlapping edits', () => {
      const source = 'Hello world';
      const result = applyTextEdits(source, [
        { start: 0, end: 5, newText: 'Hi' },
        { start: 6, end: 11, newText: 'there' },
      ]);
      expect(result).toBe('Hi there');
    });

    test('should handle edits in any order (sorts by position)', () => {
      const source = 'Hello world';
      // Edits provided in reverse order
      const result = applyTextEdits(source, [
        { start: 6, end: 11, newText: 'there' },
        { start: 0, end: 5, newText: 'Hi' },
      ]);
      expect(result).toBe('Hi there');
    });

    test('should handle insertion (start === end)', () => {
      const source = 'Hello world';
      const result = applyTextEdits(source, [
        { start: 5, end: 5, newText: ' beautiful' },
      ]);
      expect(result).toBe('Hello beautiful world');
    });

    test('should handle deletion (empty newText)', () => {
      const source = 'Hello beautiful world';
      const result = applyTextEdits(source, [
        { start: 5, end: 15, newText: '' },
      ]);
      expect(result).toBe('Hello world');
    });

    test('should handle empty edits array', () => {
      const source = 'Hello world';
      const result = applyTextEdits(source, []);
      expect(result).toBe('Hello world');
    });

    test('should handle empty source', () => {
      const source = '';
      const result = applyTextEdits(source, [
        { start: 0, end: 0, newText: 'Hello' },
      ]);
      expect(result).toBe('Hello');
    });

    test('should handle multiline text', () => {
      const source = 'Line 1\nLine 2\nLine 3';
      const result = applyTextEdits(source, [
        { start: 7, end: 13, newText: 'Modified' },
      ]);
      expect(result).toBe('Line 1\nModified\nLine 3');
    });

    test('should handle adjacent edits', () => {
      const source = 'AABBCC';
      const result = applyTextEdits(source, [
        { start: 0, end: 2, newText: 'X' },
        { start: 2, end: 4, newText: 'Y' },
        { start: 4, end: 6, newText: 'Z' },
      ]);
      expect(result).toBe('XYZ');
    });

    test('should handle edit at end of string', () => {
      const source = 'Hello';
      const result = applyTextEdits(source, [
        { start: 5, end: 5, newText: ' world' },
      ]);
      expect(result).toBe('Hello world');
    });

    test('should handle replacing entire string', () => {
      const source = 'Hello world';
      const result = applyTextEdits(source, [
        { start: 0, end: 11, newText: 'Goodbye' },
      ]);
      expect(result).toBe('Goodbye');
    });
  });

  describe('Compiler.applyTextEdits method', () => {
    test('should apply edits to compiler source', () => {
      const compiler = new Compiler();
      compiler.setSource('Table users { id int }');

      const result = compiler.applyTextEdits([
        { start: 6, end: 11, newText: 'customers' },
      ]);

      expect(result).toBe('Table customers { id int }');
    });

    test('should apply multiple edits to DBML', () => {
      const compiler = new Compiler();
      compiler.setSource(`Table users {
  id int [pk]
  email varchar
}`);

      const result = compiler.applyTextEdits([
        { start: 6, end: 11, newText: 'customers' },
        { start: 30, end: 35, newText: 'name' },
      ]);

      expect(result).toContain('Table customers');
      expect(result).toContain('name varchar');
    });

    test('should not modify the original source in compiler', () => {
      const originalSource = 'Table users { id int }';
      const compiler = new Compiler();
      compiler.setSource(originalSource);

      compiler.applyTextEdits([
        { start: 6, end: 11, newText: 'customers' },
      ]);

      // Original source should be unchanged
      expect(compiler.parse.source()).toBe(originalSource);
    });
  });
});
