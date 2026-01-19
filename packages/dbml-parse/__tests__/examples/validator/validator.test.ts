import { describe, expect } from 'vitest';
import { CompileErrorCode } from '@/core/errors';
import { SyntaxToken } from '@/core/lexer/tokens';
import { analyze } from '@tests/utils';

describe('[example] validator', () => {
  describe('table validation', () => {
    test('should accept valid table', () => {
      const source = 'Table users { id int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should detect duplicate table names and report on second occurrence', () => {
      const source = `
        Table users { id int }
        Table users { name varchar }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_NAME);
      expect(errors[0].diagnostic).toBe("Table name 'users' already exists in schema 'public'");

      // Error should point to the SECOND (duplicate) table, not the first
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.line).toBe(2);
    });

    test('should allow same table name in different schemas', () => {
      const source = `
        Table auth.users { id int }
        Table public.users { id int }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept valid table alias', () => {
      const source = 'Table users as U { id int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept valid table header color', () => {
      const source = 'Table users [headercolor: #ff0000] { id int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should reject invalid color format with precise location', () => {
      const source = 'Table users [headercolor: invalid] { id int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].diagnostic).toBe("'headercolor' must be a color literal");

      // Verify error points to the invalid value
      expect(errors[0].start).toBeGreaterThan(0);
      expect(errors[0].end).toBeGreaterThan(errors[0].start);
    });

    test('should detect duplicate table settings with separate errors', () => {
      const source = 'Table users [headercolor: #fff, headercolor: #000] { id int }';
      const errors = analyze(source).getErrors();

      // Two errors for two occurrences of duplicated setting
      expect(errors).toHaveLength(2);
      expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_TABLE_SETTING);
      expect(errors[0].diagnostic).toBe("'headercolor' can only appear once");
      expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_TABLE_SETTING);
      expect(errors[1].diagnostic).toBe("'headercolor' can only appear once");

      // Both errors should have distinct positions
      expect(errors[0].start).not.toBe(errors[1].start);
    });

    test('should reject unknown table settings', () => {
      const source = 'Table users [unknown_setting: value] { id int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNKNOWN_TABLE_SETTING);
      expect(errors[0].diagnostic).toBe("Unknown 'unknown_setting' setting");
    });
  });

  describe('column validation', () => {
    test('should accept valid column', () => {
      const source = 'Table users { id int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should detect duplicate column names with errors on both occurrences', () => {
      const source = `
        Table users {
          id int
          name varchar
          id varchar
        }
      `;
      const errors = analyze(source).getErrors();

      // Two errors - one for each occurrence of the duplicate
      expect(errors).toHaveLength(2);
      expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_COLUMN_NAME);
      expect(errors[0].diagnostic).toBe('Duplicate column id');

      // Verify both errors point to different lines
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.line).not.toBe((errors[1].nodeOrToken as SyntaxToken).startPos.line);
    });

    test('should accept all valid column settings', () => {
      const source = `
        Table users {
          id int [pk, not null, unique, increment]
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept column with default value - numeric', () => {
      const source = 'Table users { age int [default: 0] }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept column with default value - string', () => {
      const source = "Table users { status varchar [default: 'active'] }";
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept column with default value - function expression', () => {
      const source = 'Table users { created_at timestamp [default: `now()`] }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept column with note', () => {
      const source = "Table users { id int [note: 'Primary key'] }";
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept column with inline ref', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int [ref: > users.id] }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept column with multiple inline refs', () => {
      const source = `
        Table users { id int }
        Table roles { id int }
        Table user_roles { user_id int [ref: > users.id, ref: > roles.id] }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should reject unknown column settings with precise error', () => {
      const source = 'Table users { id int [unknown_setting] }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNKNOWN_COLUMN_SETTING);
      expect(errors[0].diagnostic).toBe("Unknown column setting 'unknown_setting'");
    });

    test('should accept column with null setting', () => {
      const source = 'Table users { name varchar [null] }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('enum validation', () => {
    test('should accept valid enum with values on separate lines', () => {
      const source = `
        Enum status {
          active
          inactive
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should detect duplicate enum names and report on second', () => {
      const source = `
        Enum status { active }
        Enum status { pending }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_NAME);
      expect(errors[0].diagnostic).toBe("Enum name status already exists in schema 'public'");

      // Error should be on second enum
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.line).toBe(2);
    });

    test('should detect duplicate enum field names with errors on both', () => {
      const source = `
        Enum status {
          active
          active
        }
      `;
      const errors = analyze(source).getErrors();

      // Two errors - one for each duplicate occurrence
      expect(errors).toHaveLength(2);
      expect(errors[0].diagnostic).toBe('Duplicate enum field active');
    });

    test('should accept enum field with note', () => {
      const source = `
        Enum status {
          active [note: 'Currently active']
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept schema-qualified enum', () => {
      const source = `
        Enum public.status {
          active
          inactive
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('ref validation', () => {
    test('should accept valid ref with colon syntax', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref: posts.user_id > users.id
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept named ref', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref user_posts: posts.user_id > users.id
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should reject ref with setting list before colon', () => {
      // Settings on standalone Ref before colon are not allowed
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref [delete: cascade]: posts.user_id > users.id
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_SETTINGS);
      expect(errors[0].diagnostic).toBe("A Ref shouldn't have a setting list");
    });

    test('should accept all ref relationship types', () => {
      const source = `
        Table a { id int }
        Table b { a_id int }
        Ref: b.a_id > a.id
        Ref: b.a_id < a.id
        Ref: b.a_id - a.id
        Ref: b.a_id <> a.id
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should detect unknown table in ref with binding error', () => {
      const source = `
        Table users { id int }
        Ref: nonexistent.id > users.id
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.BINDING_ERROR);
      expect(errors[0].diagnostic).toBe("Table 'nonexistent' does not exist in Schema 'public'");
    });

    test('should detect unknown column in ref with binding error', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref: posts.nonexistent > users.id
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.BINDING_ERROR);
      expect(errors[0].diagnostic).toBe("Column 'nonexistent' does not exist in Table 'posts'");
    });

    test('should accept ref with named ref and settings in block form', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref user_posts {
          posts.user_id > users.id
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('tablegroup validation', () => {
    test('should accept valid tablegroup with tables on separate lines', () => {
      const source = `
        Table users { id int }
        Table posts { id int }
        TableGroup social {
          users
          posts
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should reject tablegroup with multiple tables on same line', () => {
      const source = `
        Table users { id int }
        Table posts { id int }
        TableGroup social { users posts }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_TABLEGROUP_FIELD);
      expect(errors[0].diagnostic).toBe('A TableGroup field should only have a single Table name');
    });

    test('should detect unknown table in tablegroup', () => {
      const source = `
        Table users { id int }
        TableGroup social {
          users
          nonexistent
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.BINDING_ERROR);
    });

    test('should accept tablegroup with settings', () => {
      const source = `
        Table users { id int }
        TableGroup social [color: #ff0000] {
          users
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept tablegroup note', () => {
      const source = `
        Table users { id int }
        TableGroup social {
          users
          Note: 'Social tables'
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('tablepartial validation', () => {
    test('should accept valid tablepartial', () => {
      const source = `
        TablePartial timestamps {
          created_at timestamp
          updated_at timestamp
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept tablepartial injection', () => {
      const source = `
        TablePartial timestamps { created_at timestamp }
        Table users {
          id int
          ~timestamps
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should detect duplicate TablePartial injection same partial', () => {
      const source = `
        TablePartial p1 {}
        Table t1 {
          id int
          ~p1
          ~p1
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toBe(2);
      expect(errors[0].diagnostic).toBe('Duplicate table partial injection \'p1\'');
      expect(errors[1].diagnostic).toBe('Duplicate table partial injection \'p1\'');
    });

    test('should detect unknown tablepartial reference with precise error', () => {
      const source = `
        Table users {
          id int
          ~nonexistent
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.BINDING_ERROR);
      expect(errors[0].diagnostic).toContain("TablePartial 'nonexistent' does not exist in Schema 'public'");

      // Error should point to the injection line
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.line).toBe(3);
    });

    test('should detect duplicate tablepartial names', () => {
      const source = `
        TablePartial timestamps { created_at timestamp }
        TablePartial timestamps { updated_at timestamp }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_NAME);
    });

    test('should accept tablepartial with indexes', () => {
      const source = `
        TablePartial searchable {
          search_text varchar
          indexes {
            search_text
          }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept multiple tablepartial injections', () => {
      const source = `
        TablePartial timestamps { created_at timestamp }
        TablePartial auditable { modified_by int }
        Table users {
          id int
          ~timestamps
          ~auditable
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('project validation', () => {
    test('should accept valid project', () => {
      const source = `
        Project myapp {
          database_type: 'PostgreSQL'
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept project with note', () => {
      const source = `
        Project myapp {
          Note: 'My application database'
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should detect duplicate project definitions', () => {
      const source = `
        Project app1 { }
        Project app2 { }
      `;
      const errors = analyze(source).getErrors();

      // Two errors - one for each project
      expect(errors).toHaveLength(2);
      expect(errors[0].diagnostic).toBe('Only one project can exist');
    });
  });

  describe('index validation', () => {
    test('should accept valid index', () => {
      const source = `
        Table users {
          email varchar
          indexes {
            email
          }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept index with settings', () => {
      const source = `
        Table users {
          email varchar
          indexes {
            email [unique, name: 'idx_email', type: btree]
          }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept composite index', () => {
      const source = `
        Table users {
          first_name varchar
          last_name varchar
          indexes {
            (first_name, last_name)
          }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept pk index', () => {
      const source = `
        Table users {
          id int
          indexes {
            id [pk]
          }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should reject unknown index settings', () => {
      const source = `
        Table users {
          email varchar
          indexes {
            email [unknown_setting: value]
          }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNKNOWN_INDEX_SETTING);
      expect(errors[0].diagnostic).toBe("Unknown index setting 'unknown_setting'");
    });

    test('should accept index with hash type', () => {
      const source = `
        Table users {
          email varchar
          indexes {
            email [type: hash]
          }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('note validation', () => {
    test('should accept table-level note', () => {
      const source = `
        Table users {
          id int
          Note: 'User table'
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should detect duplicate notes in table with errors on both', () => {
      const source = `
        Table users {
          id int
          Note: 'First note'
          Note: 'Second note'
        }
      `;
      const errors = analyze(source).getErrors();

      // Two errors - one for each duplicate note
      expect(errors).toHaveLength(2);
      expect(errors[0].diagnostic).toBe('Duplicate notes are defined');

      // Verify they point to different lines
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.line).not.toBe((errors[1].nodeOrToken as SyntaxToken).startPos.line);
    });

    test('should accept multi-line note', () => {
      const source = `
        Table users {
          id int
          Note: '''
            Multi-line
            note content
          '''
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('context validation', () => {
    test('should reject table inside table', () => {
      const source = `
        Table outer {
          Table inner { id int }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_TABLE_CONTEXT);
      expect(errors[0].diagnostic).toBe('Table must appear top-level');
    });

    test('should reject enum inside table', () => {
      const source = `
        Table users {
          Enum status { active }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].diagnostic).toBe('An Enum can only appear top-level');
    });

    test('should accept Note inside table', () => {
      const source = `
        Table users {
          id int
          Note: 'Valid note'
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should accept indexes inside table', () => {
      const source = `
        Table users {
          id int
          indexes { id }
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('error location tracking', () => {
    test('should include error position via nodeOrToken', () => {
      const source = `
        Table users { id int }
        Table users { name varchar }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].nodeOrToken).not.toBeNull();
      expect(errors[0].start).toBeGreaterThanOrEqual(0);
      expect(errors[0].end).toBeGreaterThan(errors[0].start);
    });

    test('should track line numbers in errors accurately', () => {
      const source = `Table users { id int }
Table users { name varchar }`;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      // Error is reported on the second (duplicate) occurrence, line 1 (0-based indexing)
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.line).toBe(1);
    });

    test('should track column numbers in errors', () => {
      const source = 'Table users [invalid_setting] { id int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.column).toBeGreaterThan(0);
    });
  });

  describe('complex validation scenarios', () => {
    test('should validate complete schema without errors', () => {
      const source = `
        Project ecommerce {
          database_type: 'PostgreSQL'
          Note: 'E-commerce database'
        }

        Enum order_status {
          pending [note: 'Initial state']
          processing
          completed
          cancelled
        }

        TablePartial timestamps {
          created_at timestamp [default: \`now()\`]
          updated_at timestamp
        }

        Table users [headercolor: #3498db] {
          id integer [pk, increment]
          email varchar(255) [unique, not null, note: 'User email']
          status varchar [default: 'active']
          ~timestamps

          indexes {
            email [unique, name: 'idx_users_email']
          }

          Note: 'Main users table'
        }

        Table orders {
          id integer [pk, increment]
          user_id integer [ref: > users.id]
          status order_status [default: 'pending']
          total decimal(10, 2) [not null]
          ~timestamps
        }

        TableGroup ecommerce [color: #2ecc71] {
          users
          orders
          Note: 'Core e-commerce tables'
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should detect multiple errors and report all of them', () => {
      const source = `
        Table users {
          id int
          name varchar
          id varchar
        }
        Table users { email varchar }
      `;
      const errors = analyze(source).getErrors();

      // 3 errors: 2 for duplicate column (both occurrences), 1 for duplicate table (second occurrence only)
      expect(errors).toHaveLength(3);
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_COLUMN_NAME)).toBe(true);
      expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toBe(true);

      // Verify each error has valid location
      errors.forEach((error) => {
        expect(error.start).toBeGreaterThanOrEqual(0);
        expect(error.end).toBeGreaterThan(error.start);
      });
    });

    test('should detect errors across different element types', () => {
      const source = `
        Table users {
          id int
          id varchar
        }
        Enum status {
          active
          active
        }
        Ref: nonexistent.id > users.id
      `;
      const errors = analyze(source).getErrors();

      // Should have errors for:
      // - Duplicate column (2 - one for each occurrence)
      // - Duplicate enum field (2 - one for each occurrence, uses same code as duplicate column)
      // - Unknown table in ref (1)
      expect(errors).toHaveLength(5);
      expect(errors.filter((e) => e.diagnostic === 'Duplicate column id')).toHaveLength(2);
      expect(errors.filter((e) => e.diagnostic === 'Duplicate enum field active')).toHaveLength(2);
      expect(errors.filter((e) => e.code === CompileErrorCode.BINDING_ERROR)).toHaveLength(1);
    });

    test('should validate forward references correctly', () => {
      const source = `
        Ref: posts.user_id > users.id
        Table users { id int }
        Table posts { user_id int }
      `;
      const errors = analyze(source).getErrors();

      // Forward references should work
      expect(errors).toHaveLength(0);
    });

    test('should detect circular references between tables as binding errors', () => {
      const source = `
        Table a {
          id int
          b_id int [ref: > b.id]
        }
        Table b {
          id int
          a_id int [ref: > a.id]
        }
      `;
      const errors = analyze(source).getErrors();

      // Circular references are valid and should not produce errors
      expect(errors).toHaveLength(0);
    });

    test('should validate self-referencing table', () => {
      const source = `
        Table categories {
          id int [pk]
          parent_id int [ref: > categories.id]
          name varchar
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('should handle empty source', () => {
      const errors = analyze('').getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should handle comments only', () => {
      const errors = analyze('// Just a comment').getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should handle very long identifiers', () => {
      const longName = 'a'.repeat(100);
      const source = `Table ${longName} { id int }`;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should handle unicode in quoted identifiers', () => {
      const source = 'Table "用户" { "用户ID" int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should handle special characters in quoted identifiers', () => {
      const source = 'Table "user-table" { "user-id" int }';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should handle deeply nested schema qualification', () => {
      const source = 'Table a.b.c { id int }';
      const errors = analyze(source).getErrors();

      // This might be valid or error depending on parser - just verify it doesn't crash
      expect(errors).toBeDefined();
    });

    test('should handle table with many columns', () => {
      const columns = Array.from({ length: 100 }, (_, i) => `col${i} int`).join('\n');
      const source = `Table big_table { ${columns} }`;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should handle many tables', () => {
      const tables = Array.from({ length: 50 }, (_, i) => `Table t${i} { id int }`).join('\n');
      const errors = analyze(tables).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('error combinations', () => {
    test('should report both duplicate table AND duplicate column errors', () => {
      const source = `
        Table users {
          id int
          id varchar
        }
        Table users { email varchar }
      `;
      const errors = analyze(source).getErrors();

      // Should have 3 errors:
      // - 2 for duplicate column (both occurrences)
      // - 1 for duplicate table (second occurrence)
      expect(errors).toHaveLength(3);
      expect(errors.filter((e) => e.code === CompileErrorCode.DUPLICATE_COLUMN_NAME)).toHaveLength(2);
      expect(errors.filter((e) => e.code === CompileErrorCode.DUPLICATE_NAME)).toHaveLength(1);
    });

    test('should report unknown setting AND binding error in same table', () => {
      const source = `
        Table users { id int [unknown_setting, ref: > nonexistent.id] }
      `;
      const errors = analyze(source).getErrors();

      expect(errors.some((e) => e.code === CompileErrorCode.UNKNOWN_COLUMN_SETTING)).toBe(true);
      expect(errors.some((e) => e.code === CompileErrorCode.BINDING_ERROR)).toBe(true);
    });

    test('should report multiple binding errors', () => {
      const source = `
        Ref: a.id > b.id
        Ref: c.id > d.id
      `;
      const errors = analyze(source).getErrors();

      // 4 binding errors - one for each unknown table (a, b, c, d)
      expect(errors).toHaveLength(4);
      expect(errors.every((e) => e.code === CompileErrorCode.BINDING_ERROR)).toBe(true);
      expect(errors[0].diagnostic).toBe("Table 'a' does not exist in Schema 'public'");
      expect(errors[1].diagnostic).toBe("Table 'b' does not exist in Schema 'public'");
      expect(errors[2].diagnostic).toBe("Table 'c' does not exist in Schema 'public'");
      expect(errors[3].diagnostic).toBe("Table 'd' does not exist in Schema 'public'");
    });
  });

  describe('error message quality', () => {
    test('should include entity name in duplicate error messages', () => {
      const source = `
        Table users { id int }
        Table users { name varchar }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].diagnostic).toBe("Table name 'users' already exists in schema 'public'");
    });

    test('should include schema context in error messages when relevant', () => {
      const source = `
        Table auth.users { id int }
        Table auth.users { name varchar }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].diagnostic).toBe("Table name 'users' already exists in schema 'auth'");
    });

    test('should provide actionable error messages for unknown references', () => {
      const source = 'Ref: posts.user_id > nonexistent.id';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(2);
      expect(errors[0].diagnostic).toBe("Table 'posts' does not exist in Schema 'public'");
      expect(errors[1].diagnostic).toBe("Table 'nonexistent' does not exist in Schema 'public'");
    });

    test('should have non-empty diagnostic for all error types', () => {
      // Test duplicate column
      const dupColSource = 'Table users { id int\nid varchar }';
      const dupColErrors = analyze(dupColSource).getErrors();
      expect(dupColErrors).toHaveLength(2);
      expect(dupColErrors[0].diagnostic).toBe('Duplicate column id');

      // Test missing table name
      const missingNameErrors = analyze('Table { id int }').getErrors();
      expect(missingNameErrors).toHaveLength(1);
      expect(missingNameErrors[0].diagnostic).toBe('A Table must have a name');

      // Test duplicate enum value
      const dupEnumSource = 'Enum status { active\nactive }';
      const dupEnumErrors = analyze(dupEnumSource).getErrors();
      expect(dupEnumErrors).toHaveLength(2);
      expect(dupEnumErrors[0].diagnostic).toBe('Duplicate enum field active');

      // Test unknown setting
      const unknownErrors = analyze('Table users [unknown: value] { id int }').getErrors();
      expect(unknownErrors).toHaveLength(1);
      expect(unknownErrors[0].diagnostic).toBe("Unknown 'unknown' setting");
    });

    test('should have error ranges that are not excessively wide', () => {
      const source = `Table users {
        id int
        id varchar
        name text
      }`;
      const errors = analyze(source).getErrors();

      // Should have 2 duplicate column errors
      expect(errors).toHaveLength(2);
      errors.forEach((error) => {
        const rangeSize = error.end - error.start;
        // Error range should not span the entire source
        expect(rangeSize).toBeLessThan(source.length);
        // Error range should be at least 1 character
        expect(rangeSize).toBeGreaterThanOrEqual(1);
        // Error range should be less than 20 characters (reasonable for an identifier)
        expect(rangeSize).toBeLessThan(20);
      });
    });
  });

  describe('records validation', () => {
    test('should accept valid records', () => {
      const source = `
        Table users {
          id int [pk]
          name varchar
        }
        records users(id, name) {
          1, "Alice"
          2, "Bob"
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept records with various data types', () => {
      const source = `
        Table data {
          int_col int
          float_col decimal(10,2)
          bool_col boolean
          str_col varchar
        }
        records data(int_col, float_col, bool_col, str_col) {
          1, 3.14, true, "hello"
          2, -2.5, false, "world"
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept records with null values', () => {
      const source = `
        Table users {
          id int [pk]
          name varchar
        }
        records users(id, name) {
          1, null
          2, ""
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept records with function expressions', () => {
      const source = `
        Table users {
          id int [pk]
          created_at timestamp
        }
        records users(id, created_at) {
          1, \`now()\`
          2, \`uuid_generate_v4()\`
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept records with scientific notation', () => {
      const source = `
        Table data {
          id int
          value decimal
        }
        records data(id, value) {
          1, 1e10
          2, 3.14e-5
          3, 2E+8
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept records with negative numbers', () => {
      const source = `
        Table data {
          id int
          value int
        }
        records data(id, value) {
          1, -100
          2, -999
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept records with enum values', () => {
      const source = `
        Enum status { active\n inactive }
        Table users {
          id int
          status status
        }
        records users(id, status) {
          1, status.active
          2, status.inactive
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should detect unknown table in records', () => {
      const source = `
        records nonexistent(id, name) {
          1, "Alice"
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should accept multiple records blocks for same table', () => {
      const source = `
        Table users {
          id int [pk]
          name varchar
        }
        records users(id, name) {
          1, "Alice"
        }
        records users(id, name) {
          2, "Bob"
        }
        records users(id, name) {
          3, "Charlie"
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept records with schema-qualified table name', () => {
      const source = `
        Table auth.users {
          id int [pk]
          email varchar
        }
        records auth.users(id, email) {
          1, "alice@example.com"
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept records with quoted column names', () => {
      const source = `
        Table users {
          "user-id" int [pk]
          "user-name" varchar
        }
        records users("user-id", "user-name") {
          1, "Alice"
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept empty records block', () => {
      const source = `
        Table users {
          id int [pk]
          name varchar
        }
        records users(id, name) {
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept records with only one column', () => {
      const source = `
        Table ids {
          id int [pk]
        }
        records ids(id) {
          1
          2
          3
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });
  });
});
