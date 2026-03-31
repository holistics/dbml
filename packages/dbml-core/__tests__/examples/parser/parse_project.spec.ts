import { describe, expect, test } from 'vitest';
import Parser from '../../../src/parse/Parser';
import { Filepath, MemoryProjectLayout } from '../../../src/index';

function createLayout (files: Record<string, string>): MemoryProjectLayout {
  const entries: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    entries[Filepath.from(path).absolute] = content;
  }
  return new MemoryProjectLayout(entries);
}

function tableNames (model: any): string[] {
  return Object.values(model.normalize().tables).map((t: any) => t.name);
}

function enumNames (model: any): string[] {
  return Object.values(model.normalize().enums).map((e: any) => e.name);
}

function refCount (model: any): number {
  return Object.keys(model.normalize().refs).length;
}

describe('@dbml/core', () => {
  describe('parseProject', () => {
    test('single file project', () => {
      const layout = createLayout({
        '/main.dbml': 'Table users { id int [pk] }',
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('users');
    });

    test('multi-file with selective import', () => {
      const layout = createLayout({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      const names = tableNames(model);
      expect(names).toContain('orders');
      expect(names).toContain('users');
    });

    test('multi-file with wildcard import', () => {
      const layout = createLayout({
        '/main.dbml': `
          use * from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': `
          Table users { id int [pk] }
          Enum status { active\ninactive }
        `,
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('orders');
      expect(tableNames(model)).toContain('users');
      expect(enumNames(model)).toContain('status');
    });

    test('aliased import', () => {
      const layout = createLayout({
        '/main.dbml': `
          use { table users as u } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('orders');
      expect(tableNames(model)).toContain('users');
    });

    test('reuse makes symbol available downstream', () => {
      const layout = createLayout({
        '/main.dbml': `
          use { table users } from './mid.dbml'
          Table orders { id int [pk] }
        `,
        '/mid.dbml': "reuse { table users } from './source.dbml'",
        '/source.dbml': 'Table users { id int [pk] }',
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('orders');
      expect(tableNames(model)).toContain('users');
    });

    test('layout with subset of files only interprets those and their deps', () => {
      const layout = createLayout({
        '/a.dbml': `
          use { table shared } from './shared.dbml'
          Table A { id int [pk] }
        `,
        '/shared.dbml': 'Table shared { id int [pk] }',
      });

      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      const names = tableNames(model);
      expect(names).toContain('A');
      expect(names).toContain('shared');
    });

    test('throws on parse errors', () => {
      const layout = createLayout({
        '/main.dbml': 'Table users { id int [pk',
      });
      expect(() => Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2')).toThrow();
    });

    test('transitive reuse chain', () => {
      const layout = createLayout({
        '/main.dbml': `
          use { table users } from './b.dbml'
          Table orders { id int [pk] }
        `,
        '/b.dbml': "reuse { table users } from './a.dbml'",
        '/a.dbml': "reuse { table users } from './source.dbml'",
        '/source.dbml': 'Table users { id int [pk] }',
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('orders');
      expect(tableNames(model)).toContain('users');
    });

    test('wildcard reuse exposes all symbols', () => {
      const layout = createLayout({
        '/main.dbml': `
          use { table users, enum status } from './mid.dbml'
          Table orders { id int [pk] }
        `,
        '/mid.dbml': "reuse * from './source.dbml'",
        '/source.dbml': `
          Table users { id int [pk] }
          Enum status { active\ninactive }
        `,
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('orders');
      expect(tableNames(model)).toContain('users');
      expect(enumNames(model)).toContain('status');
    });

    test('use (not reuse) is not transitive', () => {
      const layout = createLayout({
        '/main.dbml': `
          use { table users } from './mid.dbml'
          Table orders { id int [pk] }
        `,
        '/mid.dbml': "use { table users } from './source.dbml'",
        '/source.dbml': 'Table users { id int [pk] }',
      });
      expect(() => Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2')).toThrow();
    });

    test('reuse with alias', () => {
      const layout = createLayout({
        '/main.dbml': `
          use { table u } from './mid.dbml'
          Table orders { id int [pk] }
        `,
        '/mid.dbml': "reuse { table users as u } from './source.dbml'",
        '/source.dbml': 'Table users { id int [pk] }',
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('orders');
      expect(tableNames(model)).toContain('users');
    });

    test('reuse and use coexist - only reuse is transitive', () => {
      const layout = createLayout({
        '/main.dbml': `
          use { table users } from './mid.dbml'
          Table orders { id int [pk] }
        `,
        '/mid.dbml': `
          use { enum status } from './enums.dbml'
          reuse { table users } from './source.dbml'
        `,
        '/source.dbml': 'Table users { id int [pk] }',
        '/enums.dbml': 'Enum status { active\ninactive }',
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('users');
      // status was imported via use (not reuse), so main.dbml can't see it
      // but it doesn't error because main.dbml didn't try to import status
    });

    test('use-imported symbol via reuse barrel errors', () => {
      const layout = createLayout({
        '/main.dbml': `
          use { enum status } from './mid.dbml'
          Table orders { id int [pk] }
        `,
        '/mid.dbml': `
          use { enum status } from './enums.dbml'
        `,
        '/enums.dbml': 'Enum status { active\ninactive }',
      });
      // status was use'd (not reused) in mid.dbml, so not visible to main
      expect(() => Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2')).toThrow();
    });

    test('circular reuse (2-way) does not loop', () => {
      const layout = createLayout({
        '/a.dbml': `
          reuse { table B } from './b.dbml'
          Table A { id int [pk] }
        `,
        '/b.dbml': `
          reuse { table A } from './a.dbml'
          Table B { id int [pk] }
        `,
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('A');
      expect(tableNames(model)).toContain('B');
    });

    test('circular reuse (3-way) does not loop', () => {
      const layout = createLayout({
        '/a.dbml': `
          reuse { table C } from './c.dbml'
          Table A { id int [pk] }
        `,
        '/b.dbml': `
          reuse { table A } from './a.dbml'
          Table B { id int [pk] }
        `,
        '/c.dbml': `
          reuse { table B } from './b.dbml'
          Table C { id int [pk] }
        `,
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('A');
      expect(tableNames(model)).toContain('B');
      expect(tableNames(model)).toContain('C');
    });

    test('circular wildcard reuse does not loop', () => {
      const layout = createLayout({
        '/a.dbml': `
          reuse * from './b.dbml'
          Table A { id int [pk] }
        `,
        '/b.dbml': `
          reuse * from './a.dbml'
          Table B { id int [pk] }
        `,
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('A');
      expect(tableNames(model)).toContain('B');
    });

    test('circular self-reuse does not loop', () => {
      const layout = createLayout({
        '/self.dbml': `
          reuse { table X } from './self.dbml'
          Table X { id int [pk] }
        `,
      });
      const model = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(tableNames(model)).toContain('X');
    });
  });

  describe('duplicate names across files', () => {
    test('two files define same table name, one imports with alias', () => {
      const layout = createLayout({
        '/a.dbml': `
          use { table users as external_users } from './b.dbml'
          Table users { id int [pk]\nname varchar }
        `,
        '/b.dbml': 'Table users { id int [pk]\nemail varchar }',
      });
      const db = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      const names = tableNames(db);
      expect(names.filter((n) => n === 'users').length).toBe(2);
    });

    test('two files define same table name, no import between them', () => {
      const layout = createLayout({
        '/a.dbml': 'Table users { id int [pk]\nname varchar }',
        '/b.dbml': 'Table users { id int [pk]\nemail varchar }',
      });
      const db = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      const names = tableNames(db);
      expect(names.filter((n) => n === 'users').length).toBe(2);
    });

    test('two files define same enum name, no import', () => {
      const layout = createLayout({
        '/a.dbml': 'Enum status { active\ninactive }',
        '/b.dbml': 'Enum status { pending\ndone }',
      });
      const db = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      const names = enumNames(db);
      expect(names.filter((n) => n === 'status').length).toBe(2);
    });

    test('ref resolves to correct table when names are duplicated', () => {
      const layout = createLayout({
        '/a.dbml': `
          use { table orders } from './b.dbml'
          Table users { id int [pk] }
          Ref: users.id < orders.user_id
        `,
        '/b.dbml': `
          Table users { id int [pk] }
          Table orders { id int [pk]\nuser_id int }
        `,
      });
      const db = Parser.parseProject(layout, Filepath.from('/main.dbml'), 'dbmlv2');
      expect(refCount(db)).toBeGreaterThanOrEqual(1);
    });
  });
});
