import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler/index';
import { applyTextEdits } from '@/compiler/queries/transform/applyTextEdits';

describe('[example] applyTextEdits', () => {
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

  describe('edge cases and boundary conditions', () => {
    test('should handle overlapping edits (applies in reverse order)', () => {
      const source = 'Hello world';
      // These edits overlap: [0,5) and [3,8)
      const result = applyTextEdits(source, [
        { start: 0, end: 5, newText: 'Hi' },
        { start: 3, end: 8, newText: 'XXX' },
      ]);
      // Note: Due to reverse-order application, results may be unexpected
      // Sorted: [3,8] first, [0,5] second
      // Edit at [3,8] applied to 'Hello world': 'Hel' + 'XXX' + 'rld' = 'HelXXXrld'
      // Edit at [0,5] applied to 'HelXXXrld': '' + 'Hi' + 'Xrld' = 'HiXrld'
      // This documents current behavior - overlapping edits produce unexpected results
      expect(result).toBe('HiXrld');
    });

    test('should handle edit beyond string bounds', () => {
      const source = 'Hello';
      // end is beyond the string length
      const result = applyTextEdits(source, [
        { start: 3, end: 100, newText: 'p' },
      ]);
      // substring(100) returns '' when beyond bounds, so this works
      expect(result).toBe('Help');
    });

    test('should handle edit with start equal to string length (append)', () => {
      const source = 'Hello';
      const result = applyTextEdits(source, [
        { start: 5, end: 5, newText: '!' },
      ]);
      expect(result).toBe('Hello!');
    });

    test('should handle edit with start greater than end', () => {
      const source = 'Hello world';
      // This is technically invalid but documents current behavior
      const result = applyTextEdits(source, [
        { start: 8, end: 3, newText: 'X' },
      ]);
      // substring(0, 8) + 'X' + substring(3) = 'Hello woX' + 'lo world' = 'Hello woXlo world'
      expect(result).toBe('Hello woXlo world');
    });

    test('should handle negative start index', () => {
      const source = 'Hello';
      // substring handles negative indices by treating them as 0
      const result = applyTextEdits(source, [
        { start: -5, end: 2, newText: 'X' },
      ]);
      // substring(0, -5) returns '', substring(2) returns 'llo'
      expect(result).toBe('Xllo');
    });

    test('should handle unicode multi-byte characters correctly', () => {
      const source = 'Hello 世界!';
      // JavaScript strings use UTF-16, so characters like 世 are single code units
      const result = applyTextEdits(source, [
        { start: 6, end: 8, newText: 'World' },
      ]);
      expect(result).toBe('Hello World!');
    });

    test('should handle emoji (surrogate pairs)', () => {
      const source = 'Hi 👋 there';
      // 👋 is 2 code units (surrogate pair)
      // Indices: H(0) i(1) (2) 👋(3-4) (5) t(6)...
      const result = applyTextEdits(source, [
        { start: 3, end: 5, newText: '!' },
      ]);
      expect(result).toBe('Hi ! there');
    });

    test('should handle completely contained edits', () => {
      const source = 'AABBCCDD';
      // Second edit is completely contained within first edit's range
      const result = applyTextEdits(source, [
        { start: 0, end: 8, newText: 'XXXX' },
        { start: 2, end: 4, newText: 'Y' },
      ]);
      // Due to reverse order: [2,4] -> 'AAY' + 'CCDD' = 'AAYCCDD'
      // Then [0,8] -> 'XXXX' (replaces everything)
      expect(result).toBe('XXXX');
    });

    test('should handle edit with NaN values gracefully', () => {
      const source = 'Hello';
      // NaN in substring is treated as 0
      const result = applyTextEdits(source, [
        { start: NaN, end: 2, newText: 'X' },
      ]);
      expect(result).toBe('Xllo');
    });

    test('should handle very large indices', () => {
      const source = 'Hello';
      const result = applyTextEdits(source, [
        { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER, newText: 'X' },
      ]);
      // Inserting at position way beyond string length
      expect(result).toBe('HelloX');
    });

    test('should preserve line endings (LF)', () => {
      const source = 'Line 1\nLine 2\nLine 3';
      const result = applyTextEdits(source, [
        { start: 7, end: 13, newText: 'Modified' },
      ]);
      expect(result).toBe('Line 1\nModified\nLine 3');
      expect(result.split('\n').length).toBe(3);
    });

    test('should preserve line endings (CRLF)', () => {
      const source = 'Line 1\r\nLine 2\r\nLine 3';
      const result = applyTextEdits(source, [
        { start: 8, end: 14, newText: 'Modified' },
      ]);
      expect(result).toBe('Line 1\r\nModified\r\nLine 3');
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
