import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
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

describe('DefinitionProvider', () => {
  it('should provide definition for table reference', () => {
    const program = readFileSync(path.resolve(__dirname, './input/definition.in.dbml'), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel(program) as any;

    // Position on "users" in "ref: > users.id"
    const position: Position = { lineNumber: 10, column: 26 };
    const definitions = definitionProvider.provideDefinition(model, position);

    expect(definitions).toBeDefined();
    expect(Array.isArray(definitions)).toBe(true);
  });

  it('should provide definition for column reference', () => {
    const program = readFileSync(path.resolve(__dirname, './input/definition.in.dbml'), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel(program) as any;

    // Position on column reference
    const position: Position = { lineNumber: 9, column: 28 };
    const definitions = definitionProvider.provideDefinition(model, position);

    expect(definitions).toBeDefined();
  });

  it('should return empty array when no definition found', () => {
    const program = 'Table test { id int }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel(program) as any;

    // Position on keyword "Table"
    const position: Position = { lineNumber: 1, column: 1 };
    const definitions = definitionProvider.provideDefinition(model, position);

    expect(definitions).toEqual([]);
  });

  it('should handle partial injection declarations', () => {
    const program = 'TablePartial users { email varchar }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 15 };
    const definitions = definitionProvider.provideDefinition(model, position);

    expect(Array.isArray(definitions)).toBe(true);
  });

  it('should handle primary expression nodes', () => {
    const program = `
      Table users { id int [pk] }
      Table posts { user_id int [ref: > users.id] }
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 3, column: 45 };
    const definitions = definitionProvider.provideDefinition(model, position);

    expect(Array.isArray(definitions)).toBe(true);
  });

  it('should handle variable nodes', () => {
    const program = `
      Table users { id int [pk] }
      Ref: posts.user_id > users.id
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 3, column: 30 };
    const definitions = definitionProvider.provideDefinition(model, position);

    expect(Array.isArray(definitions)).toBe(true);
  });
});
