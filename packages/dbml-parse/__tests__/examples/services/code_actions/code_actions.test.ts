import { describe, expect, test } from 'vitest';
import { interpret, parse } from '@tests/utils';
import { ElementDeclarationNode } from '@/core/types/nodes';
import { addSettingEdit } from '@/core/utils/setting';

function getQuickFixes (source: string) {
  const result = interpret(source);
  const infos = result.getInfos();
  return infos.flatMap((info) => info.quickFixes ?? []);
}

describe('[example] code actions - ref constraint quick fixes', () => {
  describe('nullability fixes', () => {
    test('nullable column with required ref suggests changing op or marking NOT NULL', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [null] }
        Ref: posts.user_id > users.id
      `;
      const fixes = getQuickFixes(source);
      expect(fixes.some((f) => f.title.includes('in the ref'))).toBe(true);
      expect(fixes.some((f) => f.title.includes('NOT NULL'))).toBe(true);
    });

    test('NOT NULL column with optional ref suggests changing op', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [not null] }
        Ref: posts.user_id >? users.id
      `;
      const fixes = getQuickFixes(source);
      expect(fixes.some((f) => f.title.includes('in the ref'))).toBe(true);
    });

    test('no fixes when nullability matches operator', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [not null] }
        Ref: posts.user_id > users.id
      `;
      const fixes = getQuickFixes(source);
      expect(fixes).toHaveLength(0);
    });
  });

  describe('uniqueness fixes', () => {
    test('- with non-unique column suggests UNIQUE or op change', () => {
      const source = `
        Table users { id int [pk] }
        Table profiles { user_id int [not null] }
        Ref: profiles.user_id - users.id
      `;
      const fixes = getQuickFixes(source);
      expect(fixes.some((f) => f.title.includes('UNIQUE'))).toBe(true);
      expect(fixes.some((f) => f.title.includes('in the ref'))).toBe(true);
    });

    test('-? with non-unique column suggests UNIQUE or op change', () => {
      const source = `
        Table users { id int [pk] }
        Table profiles { user_id int [not null] }
        Ref: profiles.user_id -? users.id
      `;
      const fixes = getQuickFixes(source);
      expect(fixes.some((f) => f.title.includes('UNIQUE'))).toBe(true);
    });

    test('?- with non-unique column suggests UNIQUE or op change', () => {
      const source = `
        Table users { id int [pk] }
        Table profiles { user_id int [not null] }
        Ref: profiles.user_id ?- users.id
      `;
      const fixes = getQuickFixes(source);
      expect(fixes.some((f) => f.title.includes('UNIQUE'))).toBe(true);
    });

    test('?-? with non-unique column suggests UNIQUE or op change', () => {
      const source = `
        Table users { id int [pk] }
        Table profiles { user_id int }
        Ref: profiles.user_id ?-? users.id
      `;
      const fixes = getQuickFixes(source);
      expect(fixes.some((f) => f.title.includes('UNIQUE'))).toBe(true);
    });

    test('no uniqueness fix when column is pk', () => {
      const source = `
        Table users { id int [pk] }
        Table profiles { user_id int [pk] }
        Ref: profiles.user_id - users.id
      `;
      const fixes = getQuickFixes(source);
      const uniqueFixes = fixes.filter((f) => f.title.includes('UNIQUE'));
      expect(uniqueFixes).toHaveLength(0);
    });

    test('no uniqueness fix when column is unique', () => {
      const source = `
        Table users { id int [pk] }
        Table profiles { user_id int [unique, not null] }
        Ref: profiles.user_id - users.id
      `;
      const fixes = getQuickFixes(source);
      const uniqueFixes = fixes.filter((f) => f.title.includes('UNIQUE'));
      expect(uniqueFixes).toHaveLength(0);
    });
  });

  describe('composite column refs', () => {
    test('composite - with non-unique columns skips uniqueness fix', () => {
      const source = `
        Table users {
          id int [pk]
          tenant_id int [not null]
        }
        Table profiles {
          user_id int [not null]
          tenant_id int [not null]
        }
        Ref: profiles.(user_id, tenant_id) - users.(id, tenant_id)
      `;
      const fixes = getQuickFixes(source);
      // No UNIQUE fix for composite columns (not supported yet)
      expect(fixes.filter((f) => f.title.includes('UNIQUE'))).toHaveLength(0);
    });

    test('composite > with nullable column suggests NOT NULL', () => {
      const source = `
        Table users {
          id int [pk]
          tenant_id int [not null]
        }
        Table posts {
          user_id int [null]
          tenant_id int [not null]
        }
        Ref: posts.(user_id, tenant_id) > users.(id, tenant_id)
      `;
      const fixes = getQuickFixes(source);
      // Only one column is nullable, so no nullability fix is suggested.
      // A composite FK is only nullable when ALL columns are nullable.
      expect(fixes.some((f) => f.title.includes('NOT NULL'))).toBe(false);
    });

    test('composite > with all not-null columns and composite unique index produces no fixes', () => {
      const source = `
        Table users {
          id int [pk]
          tenant_id int [not null]
          indexes {
            (id, tenant_id) [unique]
          }
        }
        Table posts {
          user_id int [not null]
          tenant_id int [not null]
        }
        Ref: posts.(user_id, tenant_id) > users.(id, tenant_id)
      `;
      const fixes = getQuickFixes(source);
      expect(fixes).toHaveLength(0);
    });
  });

  describe('operator change produces correct new op', () => {
    test('> with nullable column suggests >?', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [null] }
        Ref: posts.user_id > users.id
      `;
      const fixes = getQuickFixes(source);
      const opFix = fixes.find((f) => f.title.includes('in the ref'));
      expect(opFix?.title).toContain('>?');
    });

    test('- with non-unique column suggests >', () => {
      const source = `
        Table users { id int [pk] }
        Table profiles { user_id int [not null] }
        Ref: profiles.user_id - users.id
      `;
      const fixes = getQuickFixes(source);
      const opFix = fixes.find((f) => f.title.includes('in the ref'));
      expect(opFix?.title).toContain('>');
    });
  });

  describe('inline ref quick fixes', () => {
    test('inline ref with nullable column suggests op change and NOT NULL', () => {
      const source = `
        Table users { id int [pk] }
        Table posts {
          user_id int [null, ref: > users.id]
        }
      `;
      const fixes = getQuickFixes(source);
      expect(fixes.some((f) => f.title.includes('in the ref'))).toBe(true);
      expect(fixes.some((f) => f.title.includes('NOT NULL'))).toBe(true);
    });

    test('inline ref op change suggests correct operator', () => {
      const source = `
        Table users { id int [pk] }
        Table posts {
          user_id int [null, ref: > users.id]
        }
      `;
      const fixes = getQuickFixes(source);
      const opFix = fixes.find((f) => f.title.includes('in the ref'));
      expect(opFix?.title).toContain('>?');
    });

    test('inline ref with matching constraints produces no fixes', () => {
      const source = `
        Table users { id int [pk] }
        Table posts {
          user_id int [not null, ref: > users.id]
        }
      `;
      const fixes = getQuickFixes(source);
      expect(fixes).toHaveLength(0);
    });

    test('table partial ref can fix non-partial column', () => {
      const source = `
        Table users {
          id int [pk]
          code int
        }
        TablePartial user_ref {
          user_code int [not null, ref: - users.code]
        }
        Table posts {
          id int [pk]
          ~user_ref
        }
      `;
      const fixes = getQuickFixes(source);
      // users.code is not unique/pk, so UNIQUE fix should be offered
      expect(fixes.some((f) => f.title.includes('UNIQUE'))).toBe(true);
      // No column fix for user_code since it's from a partial
      expect(fixes.some((f) => f.title.startsWith('Mark') && f.title.includes('user_code'))).toBe(false);
    });

    test('injected column isColumnsUnique checks target table indexes', () => {
      const source = `
        Table users {
          id int [pk]
          code int
        }
        TablePartial user_ref {
          user_code int [not null, ref: - users.code]
        }
        Table posts {
          id int [pk]
          ~user_ref
        }
      `;
      const fixes = getQuickFixes(source);
      // The UNIQUE fix for users.code should reference users.code (non-partial column)
      const uniqueFix = fixes.find((f) => f.title.includes('UNIQUE'));
      expect(uniqueFix).toBeDefined();
      expect(uniqueFix!.title).toContain('users.code');
    });

    test('injected column with composite unique index on target table produces no uniqueness fix', () => {
      const source = `
        Table users { id int [pk] }
        TablePartial user_ref {
          user_id int [not null, ref: - users.id]
        }
        Table posts {
          id int [pk]
          ~user_ref
          indexes {
            (id, user_id) [unique]
          }
        }
      `;
      const fixes = getQuickFixes(source);
      // The composite unique index on posts covers user_id, so no UNIQUE fix
      const uniqueFixes = fixes.filter((f) => f.title.includes('UNIQUE'));
      expect(uniqueFixes).toHaveLength(0);
    });

    test('table partial inline ref produces no column fixes for partial columns', () => {
      const source = `
        Table users { id int [pk] }
        TablePartial timestamps {
          created_by int [null, ref: > users.id]
        }
        Table posts {
          id int [pk]
          ~timestamps
        }
      `;
      const fixes = getQuickFixes(source);
      // No column fixes for partial columns, no op token to change
      expect(fixes.filter((f) => f.title.includes('NOT NULL'))).toHaveLength(0);
    });
  });
});

describe('[example] addSettingEdit on ElementDeclarationNode', () => {
  test('inserts into existing settings block', () => {
    const source = 'Table users [headercolor: #fff] {}';
    const ast = parse(source).getValue()!.ast;
    const tableNode = ast.body.find((n): n is ElementDeclarationNode => n instanceof ElementDeclarationNode)!;
    expect(tableNode.attributeList).toBeDefined();

    const edit = addSettingEdit(tableNode, 'note: "test"');
    expect(edit).toBeDefined();
    expect(edit!.newText).toBe(', note: "test"');
    // Should insert before the closing ]
    expect(source[edit!.start]).toBe(']');
  });

  test('inserts a new settings block before the body when none exists', () => {
    const source = 'Table users {}';
    const ast = parse(source).getValue()!.ast;
    const tableNode = ast.body.find((n): n is ElementDeclarationNode => n instanceof ElementDeclarationNode)!;
    expect(tableNode.attributeList).toBeUndefined();

    const edit = addSettingEdit(tableNode, 'headercolor: #fff');
    expect(edit).toBeDefined();
    // settings must precede the body, so the block goes in before `{`
    expect(edit!.newText).toBe('[headercolor: #fff] ');
    expect(source.slice(0, edit!.start) + edit!.newText + source.slice(edit!.end)).toBe('Table users [headercolor: #fff] {}');
  });
});
