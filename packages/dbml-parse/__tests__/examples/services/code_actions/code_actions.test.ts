import {
  describe, expect, test,
} from 'vitest';
import { interpret } from '@tests/utils';

function getQuickFixes (source: string) {
  const result = interpret(source);
  const infos = result.getHints();
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
      expect(fixes.some((f) => f.title.includes('change operator'))).toBe(true);
      expect(fixes.some((f) => f.title.includes('NOT NULL'))).toBe(true);
    });

    test('NOT NULL column with optional ref suggests changing op', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [not null] }
        Ref: posts.user_id >? users.id
      `;
      const fixes = getQuickFixes(source);
      expect(fixes.some((f) => f.title.includes('change operator'))).toBe(true);
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
    test('non-unique column in one-to-one ref suggests changing op or marking UNIQUE', () => {
      const source = `
        Table users { id int [pk] }
        Table profiles { user_id int }
        Ref: profiles.user_id - users.id
      `;
      const fixes = getQuickFixes(source);
      expect(fixes.some((f) => f.title.includes('change operator'))).toBe(true);
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
  });

  describe('operator change produces correct new op', () => {
    test('> with nullable column suggests >?', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [null] }
        Ref: posts.user_id > users.id
      `;
      const fixes = getQuickFixes(source);
      const opFix = fixes.find((f) => f.title.includes('change operator'));
      expect(opFix?.title).toContain('>?');
    });

    test('- with non-unique column suggests >', () => {
      const source = `
        Table users { id int [pk] }
        Table profiles { user_id int [not null] }
        Ref: profiles.user_id - users.id
      `;
      const fixes = getQuickFixes(source);
      const opFix = fixes.find((f) => f.title.includes('change operator'));
      expect(opFix?.title).toContain('>');
    });
  });
});
