import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLReferencesProvider from '@/services/references/provider';
import { MockTextModel, createPosition } from '../../mocks';

describe('ReferencesProvider', () => {
  it('should provide references for table declaration', () => {
    const program = readFileSync(path.resolve(__dirname, './input/references.in.dbml'), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);

    const referencesProvider = new DBMLReferencesProvider(compiler);
    const model = new MockTextModel(program) as any;

    // Position on "categories" table declaration
    const position = createPosition(8, 10);
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
    const position = createPosition(3, 8);
    const references = referencesProvider.provideReferences(model, position);

    expect(Array.isArray(references)).toBe(true);
  });

  it('should return empty array when no references found', () => {
    const program = 'Table test { id int }';
    const compiler = new Compiler();
    compiler.setSource(program);

    const referencesProvider = new DBMLReferencesProvider(compiler);
    const model = new MockTextModel(program) as any;

    const position = createPosition(1, 1);
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

    const position = createPosition(2, 20);
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

    const position = createPosition(3, 5);
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

    const position = createPosition(2, 15);
    const references = referencesProvider.provideReferences(model, position);

    expect(Array.isArray(references)).toBe(true);
  });
});
