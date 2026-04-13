import { describe, expect, test } from 'vitest';
import { Compiler, CompileErrorCode } from '@/index';
import { Filepath } from '@/core/types/filepath';
import { NodeSymbol, UseSymbol, SymbolKind } from '@/core/types';
import { DEFAULT_SCHEMA_NAME } from '@/constants';

// Build a multi-file compiler from a record of absolute filepath -> source.
function makeCompiler (files: Record<string, string>): { compiler: Compiler; fps: Record<string, Filepath> } {
  const compiler = new Compiler();
  const fps: Record<string, Filepath> = {};
  for (const [path, src] of Object.entries(files)) {
    const fp = Filepath.from(path);
    fps[path] = fp;
    compiler.setSource(fp, src);
  }
  return { compiler, fps };
}

describe('[example] multifile binder', () => {
  describe('selective use — basic visibility', () => {
    test('imported table is visible in the consumer file scope', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/main.dbml': "use { table users } from './base.dbml'\nTable orders { user_id int [ref: > users.id] }",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const usersInMain = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue();
      expect(usersInMain).toBeInstanceOf(UseSymbol);
    });

    test('non-imported table from source file is NOT visible in consumer', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int }\nTable orders { id int }',
        '/main.dbml': "use { table users } from './base.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;

      const usersInMain = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue();
      expect(usersInMain).toBeInstanceOf(UseSymbol);

      // orders was not imported — not visible
      const ordersInMain = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'orders').getValue();
      expect(ordersInMain).toBeUndefined();
    });

    test('import of nonexistent element kind is rejected', () => {
      // 'table' is a valid import kind; using the wrong kind for an existing symbol
      // (e.g. importing a table as an enum) should produce a binding error
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int }',
        '/main.dbml': "use { enum users } from './base.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      // 'users' exists but is not an enum → BINDING_ERROR
      expect(errors.some((e) => e.code === CompileErrorCode.BINDING_ERROR)).toBe(true);
    });

    test('use from nonexistent file produces NONEXISTENT_MODULE error', () => {
      const { compiler, fps } = makeCompiler({
        '/main.dbml': "use { table users } from './missing.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.NONEXISTENT_MODULE)).toBe(true);
    });
  });

  describe('aliases (as keyword)', () => {
    test('aliased use replaces the table name in consumer scope', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/main.dbml': "use { table users as u } from './base.dbml'\nTable orders { user_id int [ref: > u.id] }",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;

      // 'u' is visible
      const uSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u').getValue();
      expect(uSymbol).toBeInstanceOf(UseSymbol);
      expect(compiler.symbolName(uSymbol!)).toBe('u');

      // 'users' is NOT visible under its original name
      const usersSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue();
      expect(usersSymbol).toBeUndefined();
    });

    test('aliased schema-qualified import is visible under the alias (no schema prefix)', () => {
      const { compiler, fps } = makeCompiler({
        '/auth.dbml': 'Table auth.users { id int [pk] }',
        '/main.dbml': "use { table auth.users as u } from './auth.dbml'\nTable orders { user_id int [ref: > u.id] }",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      // 'u' must be in the default (public) schema — no schema prefix
      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const uSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u').getValue();
      expect(uSymbol).toBeInstanceOf(UseSymbol);
    });

    test('inline ref to original name fails when the table was imported under an alias', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/main.dbml': "use { table users as u } from './base.dbml'\nTable orders { user_id int [ref: > users.id] }",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      // 'users' is not visible — only 'u' is
      expect(errors.length).toBeGreaterThan(0);
    });

    test('two specifiers of the same element under different aliases are both resolvable', () => {
      // Importing the same table twice under different names is valid.
      // Each alias should resolve independently.
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/main.dbml': [
          "use { table users as u } from './base.dbml'",
          "use { table users as member } from './base.dbml'",
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const uSym = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u').getValue();
      const memberSym = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'member').getValue();
      expect(uSym).toBeInstanceOf(UseSymbol);
      expect(memberSym).toBeInstanceOf(UseSymbol);
    });

    test('two symbols of the same kind and same local name is an error', () => {
      // Both specifiers result in a local name 'u' — duplicate in the same scope
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int }\nTable accounts { id int }',
        '/main.dbml': [
          "use { table users as u } from './base.dbml'",
          "use { table accounts as u } from './base.dbml'",
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(true);
    });
  });

  describe('schema-qualified import', () => {
    test('schema-qualified use has no binding errors', () => {
      const { compiler, fps } = makeCompiler({
        '/auth.dbml': 'Table auth.users { id int [pk] }',
        '/main.dbml': "use { table auth.users } from './auth.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);
    });

    test('the UseSymbol for a schema-qualified import points to the original declaration', () => {
      const { compiler, fps } = makeCompiler({
        '/auth.dbml': 'Table auth.users { id int [pk] }',
        '/main.dbml': "use { table auth.users } from './auth.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const spec = mainAst.uses[0].specifiers as any;
      const useSymbol = compiler.nodeSymbol(spec.specifiers[0]).getValue() as UseSymbol;
      expect(useSymbol).toBeInstanceOf(UseSymbol);
      // usedSymbol points to the table declaration in auth.dbml
      expect(useSymbol.usedSymbol).toBeDefined();
      expect(compiler.symbolName(useSymbol.usedSymbol!)).toBe('users');
    });

    test('reuse with schema-qualified source and alias produces a no-schema local name', () => {
      const { compiler, fps } = makeCompiler({
        '/auth.dbml': 'Table auth.users { id int [pk] }',
        '/main.dbml': "reuse { table auth.users as u } from './auth.dbml'\nTable orders { user_id int [ref: > u.id] }",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);
    });

    test('importing a nonexistent schema-qualified name produces a binding error', () => {
      const { compiler, fps } = makeCompiler({
        '/auth.dbml': 'Table auth.users { id int [pk] }',
        '/main.dbml': "use { table auth.nonexistent } from './auth.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.BINDING_ERROR)).toBe(true);
    });
  });

  describe('wildcard use', () => {
    test('wildcard use brings all public tables from source into consumer scope', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }\nTable posts { id int [pk] }',
        '/main.dbml': "use * from './base.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const usersSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue();
      const postsSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'posts').getValue();
      expect(usersSymbol).toBeInstanceOf(UseSymbol);
      expect(postsSymbol).toBeInstanceOf(UseSymbol);
    });

    test('wildcard use with schema-qualified tables has no binding errors', () => {
      // Tables from auth schema are pulled in; the auth schema is visible transitively
      // but not as a named member of the public scope (known limitation).
      const { compiler, fps } = makeCompiler({
        '/auth.dbml': 'Table auth.users { id int [pk] }\nTable auth.roles { id int [pk] }',
        '/main.dbml': "use * from './auth.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);
    });
  });

  describe('reuse (transitive re-export)', () => {
    test('reused table is visible to downstream importers', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/middle.dbml': "reuse { table users } from './base.dbml'",
        '/consumer.dbml': "use { table users } from './middle.dbml'",
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const usersInConsumer = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue();
      expect(usersInConsumer).toBeInstanceOf(UseSymbol);
    });

    test('use (non-reuse) does NOT re-export to downstream importers', () => {
      // middle.dbml uses (not reuses) users; consumer importing from middle should not see it
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/middle.dbml': "use { table users } from './base.dbml'",
        '/consumer.dbml': "use { table users } from './middle.dbml'",
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;

      // 'users' should NOT appear in consumer's scope — use does not re-export
      const usersInConsumer = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue();
      expect(usersInConsumer).toBeUndefined();
    });
  });

  describe('circular dependencies', () => {
    test('circular use does not infinite loop or crash during binding', () => {
      const { compiler, fps } = makeCompiler({
        '/x.dbml': "use { table y_table } from './y.dbml'\nTable x_table { id int [pk]\n  y_id int [ref: > y_table.id] }",
        '/y.dbml': "use { table x_table } from './x.dbml'\nTable y_table { id int [pk]\n  x_id int [ref: > x_table.id] }",
      });

      const xAst = compiler.parseFile(fps['/x.dbml']).getValue().ast;
      const yAst = compiler.parseFile(fps['/y.dbml']).getValue().ast;
      expect(() => compiler.bindNode(xAst)).not.toThrow();
      expect(() => compiler.bindNode(yAst)).not.toThrow();
      expect(compiler.bindNode(xAst).getErrors()).toHaveLength(0);
      expect(compiler.bindNode(yAst).getErrors()).toHaveLength(0);
    });
  });

  describe('enum import', () => {
    test('imported enum is visible in consumer scope', () => {
      const { compiler, fps } = makeCompiler({
        '/types.dbml': 'Enum job_status { pending running done }',
        '/main.dbml': "use { enum job_status } from './types.dbml'\nTable jobs { id int [pk]\n  status job_status }",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const enumSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Enum, 'job_status').getValue();
      expect(enumSymbol).toBeInstanceOf(UseSymbol);
    });

    test('importing a table as an enum produces a binding error', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int }',
        '/main.dbml': "use { enum users } from './base.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.BINDING_ERROR)).toBe(true);
    });
  });

  describe('tablegroup import', () => {
    test('imported tablegroup is visible in consumer scope', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }\nTable posts { id int [pk] }\nTableGroup content { users\n  posts }',
        '/main.dbml': "use { tablegroup content } from './base.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const groupSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.TableGroup, 'content').getValue();
      expect(groupSymbol).toBeInstanceOf(UseSymbol);
    });
  });

  describe('multiple import paths for the same symbol', () => {
    test('same element imported from two different paths resolves independently', () => {
      // base → middle (reuses users) → consumer imports users from both base and middle
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/middle.dbml': "reuse { table users } from './base.dbml'",
        '/consumer.dbml': [
          "use { table users as u1 } from './base.dbml'",
          "use { table users as u2 } from './middle.dbml'",
        ].join('\n'),
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const u1 = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u1').getValue();
      const u2 = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u2').getValue();
      expect(u1).toBeInstanceOf(UseSymbol);
      expect(u2).toBeInstanceOf(UseSymbol);
      // Both point to the same original declaration (users in base.dbml)
      expect((u1 as UseSymbol).usedSymbol?.declaration).toBe((u2 as UseSymbol).usedSymbol?.declaration);
    });
  });

  describe('DiagramView — non-importable', () => {
    test('wildcard use does NOT pull DiagramView into consumer scope', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': `
          Table users { id int [pk] }
          DiagramView myView {
            Tables { users }
          }
        `,
        '/main.dbml': "use * from './base.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      const dvInMain = compiler.lookupMembers(mainAst, SymbolKind.DiagramView, 'myView').getValue();
      expect(dvInMain).toBeUndefined();
    });

    test('reuse wildcard does NOT re-export DiagramView to downstream importers', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': `
          Table users { id int [pk] }
          DiagramView myView {
            Tables { users }
          }
        `,
        '/middle.dbml': "reuse * from './base.dbml'",
        '/consumer.dbml': "use * from './middle.dbml'",
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);

      const dvInConsumer = compiler.lookupMembers(consumerAst, SymbolKind.DiagramView, 'myView').getValue();
      expect(dvInConsumer).toBeUndefined();
    });

    test('DiagramView is still visible in its own file scope', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': `
          Table users { id int [pk] }
          DiagramView myView {
            Tables { users }
          }
        `,
      });

      const baseAst = compiler.parseFile(fps['/base.dbml']).getValue().ast;
      expect(compiler.bindNode(baseAst).getErrors()).toHaveLength(0);

      const dvInBase = compiler.lookupMembers(baseAst, SymbolKind.DiagramView, 'myView').getValue();
      expect(dvInBase).toBeDefined();
      expect(dvInBase!.isKind(SymbolKind.DiagramView)).toBe(true);
    });

    test('DiagramView can reference a table imported from another file', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/main.dbml': `
          use { table users } from './base.dbml'
          DiagramView myView {
            Tables { users }
          }
        `,
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);
    });

    test('DiagramView can reference a table from a wildcard import', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }\nTable posts { id int [pk] }',
        '/main.dbml': `
          use * from './base.dbml'
          DiagramView myView {
            Tables { users }
          }
        `,
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);
    });
  });
});
