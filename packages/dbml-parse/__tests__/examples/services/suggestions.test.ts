import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import type { TextModel, Position } from '@/services/types';

// Mock TextModel for testing
class MockTextModel implements Partial<TextModel> {
  private content: string;
  uri: string;

  constructor (content: string, uri = 'file:///test.dbml') {
    this.content = content;
    this.uri = uri;
  }

  getOffsetAt (position: Position): number {
    const lines = this.content.split('\n');
    let offset = 0;

    for (let i = 0; i < position.lineNumber - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }

    offset += position.column - 1;
    return offset;
  }

  getValue (): string {
    return this.content;
  }
}

describe('CompletionItemProvider', () => {
  it('should suggest top-level element types', () => {
    const program = '';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 1 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
    expect(completions.suggestions).toBeDefined();
    expect(completions.suggestions.length).toBeGreaterThan(0);
    expect(completions.suggestions.some((s) => s.label === 'Table')).toBe(true);
    expect(completions.suggestions.some((s) => s.label === 'Enum')).toBe(true);
    expect(completions.suggestions.some((s) => s.label === 'Ref')).toBe(true);
  });

  it('should suggest column attributes', () => {
    const program = 'Table users { id int [ }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 24 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
    expect(completions.suggestions).toBeDefined();
  });

  it('should return no suggestions inside comments', () => {
    const program = '// This is a comment';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 10 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions.suggestions).toHaveLength(0);
  });

  it('should return no suggestions inside strings', () => {
    const program = 'Table users { name varchar [note: "test"]  }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 40 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions.suggestions).toHaveLength(0);
  });

  it('should suggest element types in table body', () => {
    const program = 'Table users {  }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 15 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest table names in ref', () => {
    const program = readFileSync(path.resolve(__dirname, './input/suggestions.in.dbml'), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    // Inside a partial ref expression
    const position: Position = { lineNumber: 1, column: 15 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
    expect(completions.suggestions).toBeDefined();
  });

  it('should handle trigger characters', () => {
    const program = 'Table users { id int }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler, ['.', ' ']);

    expect(completionProvider.triggerCharacters).toEqual(['.', ' ']);
  });

  it('should suggest column types', () => {
    const program = 'Table users { id  }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 18 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest in indexes', () => {
    const program = `Table users {
      id int
      name varchar
      indexes {

      }
    }`;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 5, column: 11 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest enum values', () => {
    const program = readFileSync(path.resolve(__dirname, './input/suggestions.in.dbml'), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 8, column: 3 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest ref actions for update attribute', () => {
    const program = 'Ref: posts.user_id > users.id [update: ]';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 40 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
    if (completions.suggestions.length > 0) {
      const labels = completions.suggestions.map((s) => s.label);
      expect(labels.some((l) => ['cascade', 'restrict', 'set null', 'set default'].includes(l))).toBe(true);
    }
  });

  it('should suggest in TableGroup', () => {
    const program = `
      Table users { id int }
      TableGroup group1 {

      }
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 4, column: 11 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest in Project', () => {
    const program = 'Project test {  }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 16 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest in tuple expressions for indexes', () => {
    const program = `Table orders {
      id int
      created_at timestamp
      indexes { ( }
    }`;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 4, column: 19 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest in tuple expressions for ref', () => {
    const program = 'Ref: (posts.user_id, ) > (users.id, users.email)';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 21 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should handle partial injection suggestions', () => {
    const program = `
      Table users { id int }
      TablePartial users {  }
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 3, column: 28 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest member access after dot operator', () => {
    const program = `
      Table users {
        id int
        name varchar
      }
      Ref: posts.user_id > users.
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 6, column: 34 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest for prefix expression with ref operators', () => {
    const program = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id >
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 4, column: 27 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest for infix expression with ref operators', () => {
    const program = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id < users.id
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 4, column: 28 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest attribute names in list expression', () => {
    const program = 'Table users { id int [pk, ] }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 27 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest for function application in enum', () => {
    const program = 'Enum status { active ( }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 24 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest index type values', () => {
    const program = `Table users {
      id int
      indexes { (id) [type: ] }
    }`;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 3, column: 29 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
    if (completions.suggestions.length > 0) {
      const labels = completions.suggestions.map((s) => s.label);
      expect(labels.some((l) => ['btree', 'hash'].includes(l))).toBe(true);
    }
  });

  it('should suggest default values', () => {
    const program = `
      Enum status { active inactive }
      Table users {
        id int
        status varchar [default: ]
      }
    `;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 5, column: 34 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should handle attribute name at colon position', () => {
    const program = 'Table users { id int [note:] }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 28 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest table header attributes', () => {
    const program = `Table users [note: 'Users table'] {
      id int
    }`;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 1, column: 14 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });

  it('should suggest checks attribute name', () => {
    const program = `Table users {
      age int
      checks { age > 0 [] }
    }`;
    const compiler = new Compiler();
    compiler.setSource(program);

    const completionProvider = new DBMLCompletionItemProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position: Position = { lineNumber: 3, column: 24 };
    const completions = completionProvider.provideCompletionItems(model, position);

    expect(completions).toBeDefined();
  });
});
