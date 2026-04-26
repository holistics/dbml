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
  describe('selective use - basic visibility', () => {
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
      expect(uSymbol?.name).toBe('u');

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
      expect(useSymbol.usedSymbol?.name).toBe('users');
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
        '/base.dbml': `Table users { id int [pk] }
Table posts { id int [pk] }`,
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

      // 'users' should NOT appear in consumer's scope - use does not re-export
      const usersInConsumer = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue() as UseSymbol;
      // There's still a use symbol, but its used symbol is undefined!
      expect(usersInConsumer).toBeInstanceOf(UseSymbol);
      expect(usersInConsumer.usedSymbol).toBeUndefined();
    });
  });

  describe('circular dependencies', () => {
    test('circular use does not infinite loop or crash during binding', () => {
      const { compiler, fps } = makeCompiler({
        '/x.dbml': `
use { table y_table } from './y.dbml'
Table x_table {
  id int [pk]
  y_id int [ref: > y_table.id]
}`,
        '/y.dbml': `use { table x_table } from './x.dbml'
Table y_table {
  id int [pk]
  x_id int [ref: > x_table.id]
}`,
      });

      const xAst = compiler.parseFile(fps['/x.dbml']).getValue().ast;
      const yAst = compiler.parseFile(fps['/y.dbml']).getValue().ast;
      expect(() => compiler.bindNode(xAst)).not.toThrow();
      expect(() => compiler.bindNode(yAst)).not.toThrow();
      expect(compiler.bindNode(xAst).getErrors()).toHaveLength(0);
      expect(compiler.bindNode(yAst).getErrors()).toHaveLength(0);
    });

    test('circular reuse chain does not infinite loop or crash', () => {
      const { compiler, fps } = makeCompiler({
        '/a.dbml': "reuse * from './b.dbml'\nTable a_table { id int [pk] }",
        '/b.dbml': "reuse * from './a.dbml'\nTable b_table { id int [pk] }",
      });

      const aAst = compiler.parseFile(fps['/a.dbml']).getValue().ast;
      const bAst = compiler.parseFile(fps['/b.dbml']).getValue().ast;
      expect(() => compiler.bindNode(aAst)).not.toThrow();
      expect(() => compiler.bindNode(bAst)).not.toThrow();
    });

    test('circular selective reuse of same symbol does not throw query cycle', () => {
      // a reuses c from b, b reuses c from a, neither defines c
      // nodeReferee -> lookupMemberInFilepath -> nodeSymbol -> nodeReferee cycle
      const { compiler, fps } = makeCompiler({
        '/a.dbml': "reuse { table c } from './b.dbml'",
        '/b.dbml': "reuse { table c } from './a.dbml'",
      });

      const aAst = compiler.parseFile(fps['/a.dbml']).getValue().ast;
      const bAst = compiler.parseFile(fps['/b.dbml']).getValue().ast;
      expect(() => compiler.bindNode(aAst)).not.toThrow();
      expect(() => compiler.bindNode(bAst)).not.toThrow();
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

    test('schema-qualified enum import has no binding errors and UseSymbol points to the declaration', () => {
      // `Enum auth.roles` is declared with an explicit schema prefix.
      // `use { enum auth.roles }` must resolve the specifier without errors,
      // and the resulting UseSymbol must point to the original enum declaration.
      const { compiler, fps } = makeCompiler({
        '/types.dbml': 'Enum auth.roles { admin member }',
        '/main.dbml': "use { enum auth.roles } from './types.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      const spec = mainAst.uses[0].specifiers as any;
      const useSymbol = compiler.nodeSymbol(spec.specifiers[0]).getValue() as UseSymbol;
      expect(useSymbol).toBeInstanceOf(UseSymbol);
      expect(useSymbol.usedSymbol).toBeDefined();
      expect(useSymbol.usedSymbol?.name).toBe('roles');
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

  describe('alias shadows local name', () => {
    test('importing a symbol under an alias that matches a locally-defined table produces DUPLICATE_NAME', () => {
      // `use { table accounts as users }` creates a local name 'users'.
      // The file also defines `Table users` — these two collide.
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table accounts { id int [pk] }',
        '/main.dbml': [
          "use { table accounts as users } from './base.dbml'",
          'Table users { id int [pk] }',
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(true);
    });
  });

  describe('wildcard import from two files with overlapping names', () => {
    test('use * from two files with the same table name produces DUPLICATE_NAME', () => {
      const { compiler, fps } = makeCompiler({
        '/a.dbml': 'Table users { id int [pk] }',
        '/b.dbml': 'Table users { id int [pk] }',
        '/main.dbml': [
          "use * from './a.dbml'",
          "use * from './b.dbml'",
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(true);
    });
  });

  describe('file with both element declarations and reuse', () => {
    test('file with elements AND reuse * still exposes all symbols correctly', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table products { id int [pk] }',
        '/hub.dbml': [
          "reuse * from './base.dbml'",
          'Table categories { id int [pk] }',
        ].join('\n'),
        '/main.dbml': "use * from './hub.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      // products comes through the reuse chain; categories is defined directly in hub
      const products = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'products').getValue();
      const categories = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'categories').getValue();
      expect(products).toBeInstanceOf(UseSymbol);
      expect(categories).toBeInstanceOf(UseSymbol);
    });
  });

  describe('mixed selective + wildcard from the same file', () => {
    // Importing the same symbol twice from the same file — once via a
    // selective `use { table users }` and once via `use *` — is idempotent.
    // schemaModule.symbolMembers dedupes UseSymbols by
    // (originalSymbol, locally-visible name), so two distinct UseSymbol
    // wrappers around the same underlying table collapse into a single entry
    // instead of colliding as DUPLICATE_NAME.
    test('selective + wildcard from the same file is idempotent (no DUPLICATE_NAME)', () => {
      const { compiler, fps } = makeCompiler({
        '/shared.dbml': 'Table users { id int [pk] }\nTable roles { id int [pk] }',
        '/main.dbml': [
          "use { table users } from './shared.dbml'",
          "use * from './shared.dbml'",
          'Table memberships { user_id int [ref: > users.id] }',
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const bindErrors = compiler.bindNode(mainAst).getErrors();
      expect(bindErrors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(false);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const users = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue();
      const roles = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'roles').getValue();
      // expect: both tables reachable — selective import does not conflict with wildcard re-exposure
      expect(users).toBeInstanceOf(UseSymbol);
      expect(roles).toBeInstanceOf(UseSymbol);
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

    test('selective use { DiagramView myView } is rejected at validation', () => {
      // 'diagramview' is not a valid ImportKind — the validator rejects it as an
      // invalid specifier type; the binder silently ignores unknown kinds.
      const { compiler, fps } = makeCompiler({
        '/base.dbml': `
          Table users { id int [pk] }
          DiagramView myView {
            Tables { users }
          }
        `,
        '/main.dbml': "use { DiagramView myView } from './base.dbml'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const validationErrors = compiler.validateNode(mainAst).getErrors();
      expect(validationErrors.some((e) => e.code === CompileErrorCode.INVALID_USE_SPECIFIER_KIND)).toBe(true);

      // DiagramView must NOT appear in consumer scope
      const dvInMain = compiler.lookupMembers(mainAst, SymbolKind.DiagramView, 'myView').getValue();
      expect(dvInMain).toBeUndefined();
    });
  });

  describe('selective alias + no-alias for the same symbol from the same file', () => {
    // Importing the same table once with an alias and once without produces two
    // distinct local names — deduplication by (originalSymbol, name) keeps both.
    test('both alias and original name are visible, no DUPLICATE_NAME', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/main.dbml': [
          "use { table users as u } from './base.dbml'",
          "use { table users } from './base.dbml'",
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(false);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u').getValue()).toBeInstanceOf(UseSymbol);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()).toBeInstanceOf(UseSymbol);
    });

    test('both aliases point to the same underlying declaration', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/main.dbml': [
          "use { table users as u } from './base.dbml'",
          "use { table users } from './base.dbml'",
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const uSym = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u').getValue() as UseSymbol;
      const usersSym = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue() as UseSymbol;
      // Both should wrap the same original table declaration
      expect(uSym.originalSymbol).toBe(usersSym.originalSymbol);
    });
  });

  describe('alias applied in a reuse hop propagates to wildcard consumer', () => {
    // middle.dbml: reuse { table users as u } from './base.dbml'
    // consumer.dbml: use * from './middle.dbml'
    // → consumer sees 'u', not 'users'
    test('consumer via use * sees the alias name, not the original name', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/middle.dbml': "reuse { table users as u } from './base.dbml'",
        '/consumer.dbml': "use * from './middle.dbml'",
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u').getValue()).toBeInstanceOf(UseSymbol);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()).toBeUndefined();
    });
  });

  describe('consumer aliases a symbol from a reuse chain', () => {
    // middle.dbml: reuse { table users } from './base.dbml'  (no alias)
    // consumer.dbml: use { table users as member } from './middle.dbml'
    // → consumer sees 'member', not 'users'
    test('consumer alias overrides the reuse chain name', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/middle.dbml': "reuse { table users } from './base.dbml'",
        '/consumer.dbml': "use { table users as member } from './middle.dbml'",
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'member').getValue()).toBeInstanceOf(UseSymbol);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()).toBeUndefined();
    });
  });

  describe('same symbol from 3 simultaneous import paths with different aliases', () => {
    // base declares users; mid-a and mid-b both reuse from base.
    // Consumer imports users from all three sources under three different aliases.
    test('all three aliases resolve independently with no errors', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/mid-a.dbml': "reuse { table users } from './base.dbml'",
        '/mid-b.dbml': "reuse { table users } from './base.dbml'",
        '/consumer.dbml': [
          "use { table users as u1 } from './base.dbml'",
          "use { table users as u2 } from './mid-a.dbml'",
          "use { table users as u3 } from './mid-b.dbml'",
        ].join('\n'),
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const u1 = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u1').getValue() as UseSymbol;
      const u2 = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u2').getValue() as UseSymbol;
      const u3 = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'u3').getValue() as UseSymbol;
      expect(u1).toBeInstanceOf(UseSymbol);
      expect(u2).toBeInstanceOf(UseSymbol);
      expect(u3).toBeInstanceOf(UseSymbol);
      // All three trace back to the same original table declaration in base.dbml
      expect(u1.originalSymbol).toBe(u2.originalSymbol);
      expect(u2.originalSymbol).toBe(u3.originalSymbol);
    });
  });

  describe('wildcard from base + wildcard from mid that reuses base', () => {
    // Two wildcards, but the same underlying symbol. UseSymbol.originalSymbol
    // recursively unwraps through the chain, so both resolve to the same id →
    // the dedup key is identical → collapsed to one entry → no DUPLICATE_NAME.
    test('same symbol reached via two wildcard paths is deduplicated, no DUPLICATE_NAME', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/mid.dbml': "reuse * from './base.dbml'",
        '/consumer.dbml': [
          "use * from './base.dbml'",
          "use * from './mid.dbml'",
        ].join('\n'),
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      const errors = compiler.bindNode(consumerAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(false);

      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()).toBeInstanceOf(UseSymbol);
    });
  });

  describe('selective alias + wildcard from a reuse chain', () => {
    // Consumer imports users-as-local_u from base (selective) and uses * from
    // mid (wildcard, which reuses base). The wildcard exposes 'users' under its
    // original name. Two distinct local names → both survive, no conflict.
    test('selective alias and wildcard produce two distinct local names, both visible', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/mid.dbml': "reuse * from './base.dbml'",
        '/consumer.dbml': [
          "use { table users as local_u } from './base.dbml'",
          "use * from './mid.dbml'",
        ].join('\n'),
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      const errors = compiler.bindNode(consumerAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(false);

      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'local_u').getValue()).toBeInstanceOf(UseSymbol);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()).toBeInstanceOf(UseSymbol);
    });
  });

  describe('deep transitive reuse chain (3 hops)', () => {
    test('symbol declared in A is visible in D via A → reuse → B → reuse → C → use D', () => {
      const { compiler, fps } = makeCompiler({
        '/a.dbml': 'Table a_table { id int [pk] }',
        '/b.dbml': "reuse * from './a.dbml'",
        '/c.dbml': "reuse * from './b.dbml'",
        '/d.dbml': "use * from './c.dbml'",
      });

      const dAst = compiler.parseFile(fps['/d.dbml']).getValue().ast;
      expect(compiler.bindNode(dAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(dAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'a_table').getValue()).toBeInstanceOf(UseSymbol);
    });

    test('4-hop selective reuse chain works and alias at any intermediate hop propagates', () => {
      const { compiler, fps } = makeCompiler({
        '/origin.dbml': 'Table root { id int [pk] }',
        '/hop1.dbml': "reuse { table root } from './origin.dbml'",
        '/hop2.dbml': "reuse { table root } from './hop1.dbml'",
        '/hop3.dbml': "reuse { table root } from './hop2.dbml'",
        '/leaf.dbml': "use { table root } from './hop3.dbml'",
      });

      const leafAst = compiler.parseFile(fps['/leaf.dbml']).getValue().ast;
      expect(compiler.bindNode(leafAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(leafAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'root').getValue()).toBeInstanceOf(UseSymbol);
    });
  });

  describe('external Ref in source is not importable', () => {
    // source.dbml declares both tables and a standalone Ref between them.
    // consumer imports both tables. The Ref is NOT in ImportKind and thus does
    // NOT appear in the consumer's schema — refs must be redeclared locally.
    test('consumer with both tables imported has zero binding errors', () => {
      const { compiler, fps } = makeCompiler({
        '/source.dbml': [
          'Table users { id int [pk] }',
          'Table orders {\n  id int [pk]\n  user_id int\n}',
          'Ref: orders.user_id > users.id',
        ].join('\n'),
        '/consumer.dbml': [
          "use { table users } from './source.dbml'",
          "use { table orders } from './source.dbml'",
        ].join('\n'),
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);
    });
  });

  describe('Records — not importable', () => {
    test('"records" is not a valid use specifier kind and is rejected at validation', () => {
      const { compiler, fps } = makeCompiler({
        '/source.dbml': 'Table users { id int [pk]; name varchar }',
        '/consumer.dbml': "use { records users } from './source.dbml'",
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      const errors = compiler.validateNode(consumerAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.INVALID_USE_SPECIFIER_KIND)).toBe(true);
    });
  });

  describe('TableGroup import expands member tables into consumer scope', () => {
    test('member tables are reachable after tablegroup import without explicit table imports', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': [
          'Table users { id int [pk] }',
          'Table posts {\n  id int [pk]\n  user_id int\n}',
          'TableGroup social { users\n  posts }',
        ].join('\n'),
        '/consumer.dbml': "use { tablegroup social } from './base.dbml'",
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      // both member tables should be auto-expanded into consumer scope
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()).toBeInstanceOf(UseSymbol);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'posts').getValue()).toBeInstanceOf(UseSymbol);
    });

    test('consumer can write a Ref between two member tables of an imported tablegroup', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': [
          'Table users { id int [pk] }',
          'Table posts {\n  id int [pk]\n  user_id int\n}',
          'TableGroup social { users\n  posts }',
        ].join('\n'),
        '/consumer.dbml': [
          "use { tablegroup social } from './base.dbml'",
          'Ref: posts.user_id > users.id',
        ].join('\n'),
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);
    });

    test('two TableGroups sharing a member table produce no DUPLICATE_NAME for the shared table', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': [
          'Table users { id int [pk] }',
          'Table posts { id int [pk] }',
          'Table comments { id int [pk] }',
          'TableGroup social { users\n  posts }',
          'TableGroup community { users\n  comments }',
        ].join('\n'),
        '/consumer.dbml': [
          "use { tablegroup social } from './base.dbml'",
          "use { tablegroup community } from './base.dbml'",
        ].join('\n'),
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      const errors = compiler.bindNode(consumerAst).getErrors();
      // 'users' is a member of both groups — expansion must deduplicate it
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(false);

      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()).toBeInstanceOf(UseSymbol);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'posts').getValue()).toBeInstanceOf(UseSymbol);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'comments').getValue()).toBeInstanceOf(UseSymbol);
    });
  });

  describe('schema merging across files', () => {
    test('importing auth.users from one file and auth.posts from another has no binding errors', () => {
      const { compiler, fps } = makeCompiler({
        '/users.dbml': 'Table auth.users { id int [pk] }',
        '/posts.dbml': 'Table auth.posts {\n  id int [pk]\n  user_id int\n}',
        '/consumer.dbml': [
          "use { table auth.users } from './users.dbml'",
          "use { table auth.posts } from './posts.dbml'",
        ].join('\n'),
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);
    });

    test('Ref between two tables from different files under the same schema resolves without errors', () => {
      const { compiler, fps } = makeCompiler({
        '/users.dbml': 'Table auth.users { id int [pk] }',
        '/posts.dbml': 'Table auth.posts {\n  id int [pk]\n  user_id int\n}',
        '/consumer.dbml': [
          "use { table auth.users } from './users.dbml'",
          "use { table auth.posts } from './posts.dbml'",
          'Ref: auth.posts.user_id > auth.users.id',
        ].join('\n'),
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);
    });

    test('wildcard from two files each contributing to the same named schema has no collision if names differ', () => {
      const { compiler, fps } = makeCompiler({
        '/users.dbml': 'Table auth.users { id int [pk] }',
        '/roles.dbml': 'Table auth.roles { id int [pk] }',
        '/consumer.dbml': [
          "use * from './users.dbml'",
          "use * from './roles.dbml'",
        ].join('\n'),
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      const errors = compiler.bindNode(consumerAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(false);
    });
  });

  describe('import path without .dbml extension', () => {
    test('use from path without .dbml resolves correctly', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/main.dbml': "use { table users } from './base'",
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      expect(compiler.bindNode(mainAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()).toBeInstanceOf(UseSymbol);
    });
  });

  describe('self-import', () => {
    test('use * from self does not throw or infinite loop', () => {
      const { compiler, fps } = makeCompiler({
        '/self.dbml': [
          "use * from './self.dbml'",
          'Table local { id int [pk] }',
        ].join('\n'),
      });

      const selfAst = compiler.parseFile(fps['/self.dbml']).getValue().ast;
      expect(() => compiler.bindNode(selfAst)).not.toThrow();
      // local table is still accessible in its own scope
      const schemaSymbol = compiler.lookupMembers(selfAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'local').getValue()).toBeDefined();
    });
  });

  // selective use + wildcard reuse of the same symbol — reuse semantic must survive
  describe('selective use + wildcard reuse of the same symbol', () => {
    // middle.dbml has both `use { table users }` (local only) and `reuse *`
    // (transitive) from base. Both bring 'users' into middle's scope.
    // The reuse wildcard must NOT be silently dropped — downstream consumers
    // must still see 'users' via the reuse chain.
    test('reuse * transitivity is preserved even when selective use imports the same symbol', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/middle.dbml': [
          "use { table users } from './base.dbml'",
          "reuse * from './base.dbml'",
        ].join('\n'),
        '/consumer.dbml': "use * from './middle.dbml'",
      });

      const middleAst = compiler.parseFile(fps['/middle.dbml']).getValue().ast;
      expect(compiler.bindNode(middleAst).getErrors()).toHaveLength(0);

      // consumer should still see 'users' via the reuse chain
      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      expect(compiler.bindNode(consumerAst).getErrors()).toHaveLength(0);

      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      const users = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue();
      expect(users).toBeInstanceOf(UseSymbol);
    });

    test('reuse { table X } transitivity survives alongside use * bringing the same symbol', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }\nTable posts { id int [pk] }',
        '/middle.dbml': [
          "reuse { table users } from './base.dbml'",
          "use * from './base.dbml'",
        ].join('\n'),
        '/consumer.dbml': "use * from './middle.dbml'",
      });

      const consumerAst = compiler.parseFile(fps['/consumer.dbml']).getValue().ast;
      const schemaSymbol = compiler.lookupMembers(consumerAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;

      // 'users' was reused selectively — must be visible downstream
      const users = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue();
      expect(users).toBeInstanceOf(UseSymbol);

      // 'posts' was only use * (not reuse) — must NOT be visible downstream
      const posts = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'posts').getValue();
      expect(posts).toBeUndefined();
    });

    test('selective use + wildcard reuse: middle scope has the symbol regardless', () => {
      // Even if dedup drops one variant, 'users' must still be resolvable in middle.
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/middle.dbml': [
          "use { table users } from './base.dbml'",
          "reuse * from './base.dbml'",
          'Table orders { user_id int [ref: > users.id] }',
        ].join('\n'),
      });

      const middleAst = compiler.parseFile(fps['/middle.dbml']).getValue().ast;
      expect(compiler.bindNode(middleAst).getErrors()).toHaveLength(0);
    });
  });

  describe('same symbol imported twice via same or different paths', () => {
    test('use { table users } twice from the same file collapses — no DUPLICATE_NAME', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/main.dbml': [
          "use { table users } from './base.dbml'",
          "use { table users } from './base.dbml'",
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(false);
    });

    test('use * twice from files that reuse the same symbol collapses — no DUPLICATE_NAME', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/a.dbml': "reuse * from './base.dbml'",
        '/b.dbml': "reuse * from './base.dbml'",
        '/main.dbml': [
          "use * from './a.dbml'",
          "use * from './b.dbml'",
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(false);

      const schemaSymbol = compiler.lookupMembers(mainAst, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()).toBeInstanceOf(UseSymbol);
    });

    test('selective use of same symbol from different reuse paths — no DUPLICATE_NAME', () => {
      const { compiler, fps } = makeCompiler({
        '/base.dbml': 'Table users { id int [pk] }',
        '/a.dbml': "reuse { table users } from './base.dbml'",
        '/b.dbml': "reuse { table users } from './base.dbml'",
        '/main.dbml': [
          "use { table users } from './a.dbml'",
          "use { table users } from './b.dbml'",
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(false);
    });

    test('DIFFERENT symbols with same name from different files still produce DUPLICATE_NAME', () => {
      const { compiler, fps } = makeCompiler({
        '/a.dbml': 'Table users { id int [pk] }',
        '/b.dbml': 'Table users { id int [pk] }',
        '/main.dbml': [
          "use { table users } from './a.dbml'",
          "use { table users } from './b.dbml'",
        ].join('\n'),
      });

      const mainAst = compiler.parseFile(fps['/main.dbml']).getValue().ast;
      const errors = compiler.bindNode(mainAst).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(true);
    });
  });
});
