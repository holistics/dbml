import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLReferencesProvider from '@/services/references/provider';
import type { TextModel, Position } from '@/services/types';

// Mock TextModel for testing
class MockTextModel implements Partial<TextModel> {
  private content: string;
  uri: string;

  constructor(content: string, uri = 'file:///test.dbml') {
    this.content = content;
    this.uri = uri;
  }

  getOffsetAt(position: Position): number {
    const lines = this.content.split('\n');
    let offset = 0;

    for (let i = 0; i < position.lineNumber - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }

    offset += position.column - 1;
    return offset;
  }

  getValue(): string {
    return this.content;
  }
}

describe('ReferencesProvider', () => {
  it('should provide references for table declaration', () => {
    const program = readFileSync(path.resolve(__dirname, './input/references.in.dbml'), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);

    const referencesProvider = new DBMLReferencesProvider(compiler);
    const model = new MockTextModel(program) as any;

    // Position on "categories" table declaration
    const position: Position = { lineNumber: 8, column: 10 };
    const references = referencesProvider.provideReferences(model, position);

    expect(references).toBeDefined();
    expect(Array.isArray(references)).toBe(true);
  });

  it('should provide references for column', () => {
    const program = readFileSync(path.resolve(__dirname, './input/references.in.dbml'), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);

    const referencesProvider = new DBMLReferencesProvider(compiler);
    const model = new MockTextModel(program) as any;

    // Position on column
    const position: Position = { lineNumber: 3, column: 8 };
    const references = referencesProvider.provideReferences(model, position);

    expect(Array.isArray(references)).toBe(true);
  });

  it('should return empty array when no references found', () => {
    const program = 'Table test { id int }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const referencesProvider = new DBMLReferencesProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 1 };
    const references = referencesProvider.provideReferences(model, position);

    expect(references).toEqual([]);
  });

  it('should handle primary expression nodes', () => {
    const program = `
      Table users { id int [pk] }
      Table posts { user_id int [ref: > users.id] }
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const referencesProvider = new DBMLReferencesProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 2, column: 20 };
    const references = referencesProvider.provideReferences(model, position);

    expect(Array.isArray(references)).toBe(true);
  });

  it('should handle function application nodes', () => {
    const program = `
      Table orders {
        id int [pk]
        total decimal
        indexes { (id, total) }
      }
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const referencesProvider = new DBMLReferencesProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 3, column: 5 };
    const references = referencesProvider.provideReferences(model, position);

    expect(Array.isArray(references)).toBe(true);
  });

  it('should handle element declaration nodes', () => {
    const program = `
      Table products { id int [pk] }
      Ref: orders.product_id > products.id
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const referencesProvider = new DBMLReferencesProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 2, column: 15 };
    const references = referencesProvider.provideReferences(model, position);

    expect(Array.isArray(references)).toBe(true);
  });
});
