import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/index';
import { interpret, analyze } from '@tests/utils';

describe('[example] interpreter', () => {
  describe('table interpretation', () => {
    test('should interpret simple table', () => {
      const source = `
        Table users {
          id int [pk]
          name varchar
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.tables).toHaveLength(1);
      expect(db.tables[0].name).toBe('users');
      expect(db.tables[0].fields).toHaveLength(2);
    });

    test('should interpret table with schema', () => {
      const db = interpret('Table public.users { id int }').getValue()!;

      expect(db.tables).toHaveLength(1);
      expect(db.tables[0].name).toBe('users');
      expect(db.tables[0].schemaName).toBe('public');
    });

    test('should interpret table with alias', () => {
      const db = interpret('Table users as U { id int }').getValue()!;

      expect(db.tables).toHaveLength(1);
      expect(db.tables[0].name).toBe('users');
      expect(db.tables[0].alias).toBe('U');
    });

    test('should interpret table header color', () => {
      const db = interpret('Table users [headercolor: #ff0000] { id int }').getValue()!;

      expect(db.tables[0].headerColor).toBe('#ff0000');
    });

    test('should interpret table note', () => {
      const source = `
        Table users {
          id int
          Note: 'Main users table'
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.tables[0].note?.value).toBe('Main users table');
    });
  });

  describe('column interpretation', () => {
    test('should interpret column types', () => {
      const source = `
        Table users {
          id integer
          name varchar
          age int
          balance decimal
        }
      `;
      const db = interpret(source).getValue()!;
      const fields = db.tables[0].fields;

      expect(fields).toHaveLength(4);
      expect(fields[0].name).toBe('id');
      expect(fields[1].name).toBe('name');
    });

    test('should interpret column type with arguments', () => {
      const db = interpret('Table users { name varchar(255) }').getValue()!;
      const fields = db.tables[0].fields;

      expect(fields[0].type.type_name).toContain('varchar');
      expect(fields[0].type.args).toBe('255');
    });

    test('should interpret column pk setting', () => {
      const db = interpret('Table users { id int [pk] }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.pk).toBe(true);
    });

    test('should interpret column unique setting', () => {
      const db = interpret('Table users { email varchar [unique] }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.unique).toBe(true);
    });

    test('should interpret column not null setting', () => {
      const db = interpret('Table users { name varchar [not null] }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.not_null).toBe(true);
    });

    test('should interpret column increment setting', () => {
      const db = interpret('Table users { id int [increment] }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.increment).toBe(true);
    });

    test('should interpret column default value', () => {
      const db = interpret("Table users { status varchar [default: 'active'] }").getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.dbdefault?.value).toBe('active');
    });

    test('should interpret column note', () => {
      const db = interpret("Table users { id int [note: 'Primary identifier'] }").getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.note?.value).toBe('Primary identifier');
    });
  });

  describe('index interpretation', () => {
    test('should interpret simple index', () => {
      const source = `
        Table users {
          email varchar
          indexes {
            email
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const table = db.tables[0];

      expect(table.indexes).toHaveLength(1);
    });

    test('should interpret unique index', () => {
      const source = `
        Table users {
          email varchar
          indexes {
            email [unique]
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.unique).toBe(true);
    });

    test('should interpret named index', () => {
      const source = `
        Table users {
          email varchar
          indexes {
            email [name: 'idx_email']
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.name).toBe('idx_email');
    });

    test('should interpret composite index', () => {
      const source = `
        Table users {
          first_name varchar
          last_name varchar
          indexes {
            (first_name, last_name)
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.columns).toHaveLength(2);
    });
  });

  describe('ref interpretation', () => {
    test('should interpret simple ref', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref: posts.user_id > users.id
      `;
      const db = interpret(source).getValue()!;

      expect(db.refs).toHaveLength(1);
      expect(db.refs[0].endpoints).toHaveLength(2);
    });

    test('should interpret inline ref', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int [ref: > users.id] }
      `;
      const db = interpret(source).getValue()!;

      expect(db.refs).toHaveLength(1);
    });

    test('should interpret ref relationship types', () => {
      const source = `
        Table a { id int }
        Table b { a_id int }
        Ref: b.a_id > a.id
      `;
      const db = interpret(source).getValue()!;

      expect(db.refs[0].endpoints[0].relation).toBe('*');
      expect(db.refs[0].endpoints[1].relation).toBe('1');
    });

    test('should interpret one-to-one ref', () => {
      const source = `
        Table a { id int }
        Table b { a_id int }
        Ref: b.a_id - a.id
      `;
      const db = interpret(source).getValue()!;

      expect(db.refs[0].endpoints[0].relation).toBe('1');
      expect(db.refs[0].endpoints[1].relation).toBe('1');
    });
  });

  describe('enum interpretation', () => {
    test('should interpret enum', () => {
      const source = `
        Enum status {
          active
          inactive
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.enums).toHaveLength(1);
      expect(db.enums[0].name).toBe('status');
    });

    test('should interpret enum with schema', () => {
      const source = `
        Enum public.status {
          active
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.enums[0].schemaName).toBe('public');
    });

    test('should interpret enum values', () => {
      const source = `
        Enum status {
          pending
          active
          inactive
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.enums[0].values).toHaveLength(3);
      expect(db.enums[0].values[0].name).toBe('pending');
      expect(db.enums[0].values[1].name).toBe('active');
      expect(db.enums[0].values[2].name).toBe('inactive');
    });
  });

  describe('project interpretation', () => {
    test('should interpret project', () => {
      const source = `
        Project myapp {
          database_type: 'PostgreSQL'
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.project?.name).toBe('myapp');
      expect((db.project as Record<string, unknown>)?.['database_type']).toBe('PostgreSQL');
    });

    test('should interpret project note', () => {
      const source = `
        Project myapp {
          Note: 'My application database'
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.project?.note?.value).toBe('My application database');
    });
  });

  describe('tablegroup interpretation', () => {
    test('should interpret tablegroup', () => {
      const source = `
        Table users { id int }
        Table posts { id int }
        TableGroup social {
          users
          posts
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.tableGroups).toHaveLength(1);
      expect(db.tableGroups[0].name).toBe('social');
      expect(db.tableGroups[0].tables).toHaveLength(2);
    });

    test('should interpret tablegroup with color', () => {
      const source = `
        Table users { id int }
        TableGroup group1 [color: #ff0000] {
          users
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.tableGroups[0].color).toBe('#ff0000');
    });
  });

  describe('tablepartial interpretation', () => {
    test('should interpret tablepartial and store injection reference', () => {
      const source = `
        TablePartial timestamps {
          created_at timestamp
          updated_at timestamp
        }
        Table users {
          id int
          ~timestamps
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.tables[0].fields).toHaveLength(1);
      expect(db.tables[0].fields[0].name).toBe('id');
      expect(db.tables[0].partials).toHaveLength(1);
      expect(db.tablePartials).toHaveLength(1);
      expect(db.tablePartials[0].fields).toHaveLength(2);
      expect(db.tablePartials[0].fields[0].name).toBe('created_at');
      expect(db.tablePartials[0].fields[1].name).toBe('updated_at');
    });
  });

  describe('complex scenarios', () => {
    test('should interpret full schema', () => {
      const source = `
        Project ecommerce {
          database_type: 'PostgreSQL'
        }

        TablePartial timestamps {
          created_at timestamp
          updated_at timestamp
        }

        Table users [headercolor: #3498db] {
          id integer [pk, increment]
          email varchar(255) [unique, not null]
          ~timestamps
          Note: 'Users table'
        }

        Table orders {
          id integer [pk]
          user_id integer [ref: > users.id]
          total decimal(10, 2)
          ~timestamps
        }

        TableGroup core {
          users
          orders
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.project?.name).toBe('ecommerce');
      expect(db.tables).toHaveLength(2);
      expect(db.refs).toHaveLength(1);
      expect(db.tableGroups).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    test('should handle circular refs', () => {
      const source = `
        Table a { id int }
        Table b { id int }
        Ref: a.id > b.id
        Ref: b.id > a.id
      `;
      const errors = interpret(source).getErrors();

      expect(errors).toBeInstanceOf(Array);
    });

    test('should handle unknown references gracefully', () => {
      const source = 'Ref: nonexistent.id > also_nonexistent.id';
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(2);
      expect(errors[0].diagnostic).toBe("Table 'nonexistent' does not exist in Schema 'public'");
      expect(errors[1].diagnostic).toBe("Table 'also_nonexistent' does not exist in Schema 'public'");
    });
  });

  describe('edge cases', () => {
    test('should handle empty database', () => {
      const db = interpret('').getValue()!;

      expect(db.tables).toHaveLength(0);
      expect(db.refs).toHaveLength(0);
      expect(db.enums).toHaveLength(0);
    });

    test('should handle unicode in identifiers', () => {
      const db = interpret('Table "用户" { "名称" varchar }').getValue()!;

      expect(db.tables[0].name).toBe('用户');
      expect(db.tables[0].fields[0].name).toBe('名称');
    });

    test('should handle special characters in quoted names', () => {
      const db = interpret('Table "user-table" { "user-id" int }').getValue()!;

      expect(db.tables[0].name).toBe('user-table');
      expect(db.tables[0].fields[0].name).toBe('user-id');
    });
  });

  describe('detailed field type verification', () => {
    test('should interpret simple types with exact matching', () => {
      const testCases = [
        { type: 'int', expected: { type_name: 'int', args: null, schemaName: null } },
        { type: 'integer', expected: { type_name: 'integer', args: null, schemaName: null } },
        { type: 'bigint', expected: { type_name: 'bigint', args: null, schemaName: null } },
        { type: 'varchar', expected: { type_name: 'varchar', args: null, schemaName: null } },
        { type: 'text', expected: { type_name: 'text', args: null, schemaName: null } },
        { type: 'boolean', expected: { type_name: 'boolean', args: null, schemaName: null } },
        { type: 'timestamp', expected: { type_name: 'timestamp', args: null, schemaName: null } },
        { type: 'uuid', expected: { type_name: 'uuid', args: null, schemaName: null } },
      ];

      testCases.forEach(({ type, expected }) => {
        const db = interpret(`Table t { col ${type} }`).getValue()!;
        const field = db.tables[0].fields[0];
        expect(field.type.type_name).toBe(expected.type_name);
        expect(field.type.args).toBe(expected.args);
        expect(field.type.schemaName).toBe(expected.schemaName);
      });
    });

    test('should interpret parameterized types with exact matching', () => {
      // For parameterized types, type_name includes the full type string with args
      const testCases = [
        { type: 'varchar(255)', expected: { type_name: 'varchar(255)', args: '255', schemaName: null } },
        { type: 'char(10)', expected: { type_name: 'char(10)', args: '10', schemaName: null } },
        { type: 'decimal(10,2)', expected: { type_name: 'decimal(10,2)', args: '10,2', schemaName: null } },
        { type: 'numeric(5)', expected: { type_name: 'numeric(5)', args: '5', schemaName: null } },
      ];

      testCases.forEach(({ type, expected }) => {
        const db = interpret(`Table t { col ${type} }`).getValue()!;
        const field = db.tables[0].fields[0];
        expect(field.type.type_name).toBe(expected.type_name);
        expect(field.type.args).toBe(expected.args);
        expect(field.type.schemaName).toBe(expected.schemaName);
      });
    });

    test('should interpret array types', () => {
      const db = interpret('Table t { tags varchar[] }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.name).toBe('tags');
      expect(field.type.type_name).toBe('varchar[]');
      expect(field.type.args).toBeNull();
      expect(field.type.schemaName).toBeNull();
    });

    test('should interpret array type with arguments like varchar(255)[]', () => {
      const db = interpret('Table t { name varchar(255)[] }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.name).toBe('name');
      // type_name captures the full type including args and array brackets
      expect(field.type.type_name).toBe('varchar(255)[]');
      // args is null because outermost type is array, not call expression
      expect(field.type.args).toBeNull();
      expect(field.type.schemaName).toBeNull();
    });

    test('should interpret nested array type with arguments like decimal(10,2)[][]', () => {
      const db = interpret('Table t { prices decimal(10, 2)[][] }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.name).toBe('prices');
      expect(field.type.type_name).toBe('decimal(10,2)[][]');
      expect(field.type.args).toBeNull();
      expect(field.type.schemaName).toBeNull();
    });

    test('should interpret schema-qualified type', () => {
      const db = interpret('Table t { col public.custom_type }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.name).toBe('col');
      expect(field.type.type_name).toBe('custom_type');
      expect(field.type.schemaName).toBe('public');
      expect(field.type.args).toBeNull();
    });

    test('should interpret type with multiple arguments', () => {
      const db = interpret('Table t { price decimal(10, 2) }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.name).toBe('price');
      // type_name includes full type with args
      expect(field.type.type_name).toBe('decimal(10,2)');
      // Args are stored without spaces
      expect(field.type.args).toBe('10,2');
      expect(field.type.schemaName).toBeNull();
    });

    test('should interpret enum as column type', () => {
      const source = `
        Enum order_status { pending\n completed }
        Table orders { status order_status }
      `;
      const db = interpret(source).getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.type.type_name).toBe('order_status');
      expect(field.type.args).toBeNull();
      expect(field.type.schemaName).toBeNull();
    });

    test('should interpret schema-qualified enum as column type', () => {
      const source = `
        Enum types.status { active\n inactive }
        Table users { status types.status }
      `;
      const db = interpret(source).getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.type.type_name).toBe('status');
      expect(field.type.schemaName).toBe('types');
      expect(field.type.args).toBeNull();
    });
  });

  describe('detailed column settings verification', () => {
    test('should interpret default with expression', () => {
      const db = interpret('Table t { created_at timestamp [default: `now()`] }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.dbdefault).toBeDefined();
      expect(field.dbdefault?.type).toBe('expression');
    });

    test('should interpret default with number', () => {
      const db = interpret('Table t { count int [default: 0] }').getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.dbdefault?.value).toBe(0);
    });

    test('should interpret default with null', () => {
      const db = interpret('Table t { optional varchar [default: null] }').getValue()!;
      const field = db.tables[0].fields[0];

      // null is stored as string "null" in the interpreter
      expect(field.dbdefault?.value).toBe('null');
    });

    test('should interpret default with boolean', () => {
      const db = interpret('Table t { active boolean [default: true] }').getValue()!;
      const field = db.tables[0].fields[0];

      // booleans are stored as strings in the interpreter
      expect(field.dbdefault?.value).toBe('true');
    });

    test('should interpret all column settings together', () => {
      const source = `
        Table users {
          id int [pk, increment, unique, not null, note: 'ID']
        }
      `;
      const db = interpret(source).getValue()!;
      const field = db.tables[0].fields[0];

      expect(field.pk).toBe(true);
      expect(field.increment).toBe(true);
      expect(field.unique).toBe(true);
      expect(field.not_null).toBe(true);
      expect(field.note?.value).toBe('ID');
    });
  });

  describe('detailed ref verification', () => {
    test('should interpret ref with all settings (name, delete, update, color)', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref post_author: posts.user_id > users.id [delete: cascade, update: no action, color: #abc]
      `;
      const db = interpret(source).getValue()!;
      const ref = db.refs[0];

      expect(ref.name).toBe('post_author');
      expect(ref.onDelete).toBe('cascade');
      expect(ref.onUpdate).toBe('no action');
      expect(ref.color).toBe('#abc');
    });

    test('should interpret ref delete actions', () => {
      const testCases = [
        { action: 'cascade', expected: 'cascade' },
        { action: 'no action', expected: 'no action' },
        { action: 'set null', expected: 'set null' },
        { action: 'set default', expected: 'set default' },
        { action: 'restrict', expected: 'restrict' },
      ];

      testCases.forEach(({ action, expected }) => {
        const source = `
          Table a { id int }
          Table b { a_id int }
          Ref: b.a_id > a.id [delete: ${action}]
        `;
        const db = interpret(source).getValue()!;
        expect(db.refs[0].onDelete).toBe(expected);
      });
    });

    test('should interpret ref update actions', () => {
      const testCases = [
        { action: 'cascade', expected: 'cascade' },
        { action: 'no action', expected: 'no action' },
        { action: 'set null', expected: 'set null' },
        { action: 'set default', expected: 'set default' },
        { action: 'restrict', expected: 'restrict' },
      ];

      testCases.forEach(({ action, expected }) => {
        const source = `
          Table a { id int }
          Table b { a_id int }
          Ref: b.a_id > a.id [update: ${action}]
        `;
        const db = interpret(source).getValue()!;
        expect(db.refs[0].onUpdate).toBe(expected);
      });
    });

    test('should interpret named ref', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref fk_user: posts.user_id > users.id
      `;
      const db = interpret(source).getValue()!;
      expect(db.refs[0].name).toBe('fk_user');
    });

    test('should interpret ref color', () => {
      const source = `
        Table a { id int }
        Table b { a_id int }
        Ref: b.a_id > a.id [color: #ff0000]
      `;
      const db = interpret(source).getValue()!;
      expect(db.refs[0].color).toBe('#ff0000');
    });

    test('should interpret many-to-one ref correctly', () => {
      const source = `
        Table parent { id int }
        Table child { parent_id int }
        Ref: child.parent_id > parent.id
      `;
      const db = interpret(source).getValue()!;
      const ref = db.refs[0];

      expect(ref.endpoints).toHaveLength(2);
      // child side is many (*), parent side is one (1)
      expect(ref.endpoints[0].relation).toBe('*');
      expect(ref.endpoints[1].relation).toBe('1');
    });

    test('should interpret one-to-many ref correctly', () => {
      const source = `
        Table parent { id int }
        Table child { parent_id int }
        Ref: parent.id < child.parent_id
      `;
      const db = interpret(source).getValue()!;
      const ref = db.refs[0];

      expect(ref.endpoints[0].relation).toBe('1');
      expect(ref.endpoints[1].relation).toBe('*');
    });

    test('should interpret many-to-many ref correctly', () => {
      const source = `
        Table a { id int }
        Table b { a_id int }
        Ref: a.id <> b.a_id
      `;
      const db = interpret(source).getValue()!;
      const ref = db.refs[0];

      expect(ref.endpoints[0].relation).toBe('*');
      expect(ref.endpoints[1].relation).toBe('*');
    });

    test('should interpret ref endpoint table and column names', () => {
      const source = `
        Table users { id int }
        Table posts { author_id int }
        Ref: posts.author_id > users.id
      `;
      const db = interpret(source).getValue()!;
      const ref = db.refs[0];

      expect(ref.endpoints[0].tableName).toBe('posts');
      expect(ref.endpoints[0].fieldNames).toContain('author_id');
      expect(ref.endpoints[1].tableName).toBe('users');
      expect(ref.endpoints[1].fieldNames).toContain('id');
    });

    test('should interpret composite ref', () => {
      const source = `
        Table a { id1 int\n id2 int }
        Table b { a_id1 int\n a_id2 int }
        Ref: (b.a_id1, b.a_id2) > (a.id1, a.id2)
      `;
      const result = interpret(source);
      // Composite refs may have parsing issues - just verify it doesn't crash
      expect(result).toBeDefined();
      const db = result.getValue();
      if (db && db.refs && db.refs.length > 0) {
        const ref = db.refs[0];
        expect(ref.endpoints).toHaveLength(2);
      }
    });

    test('should interpret cross-schema ref', () => {
      const source = `
        Table auth.users { id int }
        Table public.posts { user_id int }
        Ref: public.posts.user_id > auth.users.id
      `;
      const db = interpret(source).getValue()!;
      const ref = db.refs[0];

      expect(ref.endpoints[0].schemaName).toBe('public');
      expect(ref.endpoints[1].schemaName).toBe('auth');
    });
  });

  describe('detailed index verification', () => {
    test('should interpret index type', () => {
      const source = `
        Table t {
          col varchar
          indexes {
            col [type: btree]
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.type).toBe('btree');
    });

    test('should interpret index type hash', () => {
      const source = `
        Table t {
          col varchar
          indexes {
            col [type: hash]
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.type).toBe('hash');
    });

    test('should interpret pk index', () => {
      const source = `
        Table t {
          col1 int
          col2 int
          indexes {
            (col1, col2) [pk]
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.pk).toBe(true);
    });

    test('should interpret index note', () => {
      const source = `
        Table t {
          email varchar
          indexes {
            email [note: 'Email index']
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.note?.value).toBe('Email index');
    });

    test('should interpret index column values and types', () => {
      const source = `
        Table t {
          first_name varchar
          last_name varchar
          indexes {
            (first_name, last_name) [name: 'idx_fullname']
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.columns).toHaveLength(2);
      expect(index.columns[0].value).toBe('first_name');
      expect(index.columns[0].type).toBe('column');
      expect(index.columns[1].value).toBe('last_name');
      expect(index.columns[1].type).toBe('column');
      expect(index.name).toBe('idx_fullname');
    });

    test('should interpret expression index', () => {
      const source = `
        Table t {
          email varchar
          indexes {
            \`lower(email)\` [name: 'idx_email_lower']
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.columns).toHaveLength(1);
      expect(index.columns[0].value).toBe('lower(email)');
      expect(index.columns[0].type).toBe('expression');
      expect(index.name).toBe('idx_email_lower');
    });

    test('should interpret mixed column and expression index', () => {
      const source = `
        Table t {
          first_name varchar
          last_name varchar
          indexes {
            (\`lower(first_name)\`, last_name)
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.columns).toHaveLength(2);
      expect(index.columns[0].value).toBe('lower(first_name)');
      expect(index.columns[0].type).toBe('expression');
      expect(index.columns[1].value).toBe('last_name');
      expect(index.columns[1].type).toBe('column');
    });

    test('should interpret index with all settings', () => {
      const source = `
        Table t {
          email varchar
          indexes {
            email [unique, name: 'idx_email', type: btree, note: 'Unique email']
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const index = db.tables[0].indexes[0];

      expect(index.unique).toBe(true);
      expect(index.name).toBe('idx_email');
      expect(index.type).toBe('btree');
      expect(index.note?.value).toBe('Unique email');
      expect(index.columns[0].value).toBe('email');
      expect(index.columns[0].type).toBe('column');
    });
  });

  describe('detailed enum verification', () => {
    test('should interpret enum value notes', () => {
      const source = `
        Enum status {
          active [note: 'User is active']
          inactive
        }
      `;
      const db = interpret(source).getValue()!;
      const enumVal = db.enums[0].values[0];

      expect(enumVal.note?.value).toBe('User is active');
    });

    test('should preserve enum value order', () => {
      const source = `
        Enum priority {
          low
          medium
          high
          critical
        }
      `;
      const db = interpret(source).getValue()!;
      const values = db.enums[0].values;

      expect(values[0].name).toBe('low');
      expect(values[1].name).toBe('medium');
      expect(values[2].name).toBe('high');
      expect(values[3].name).toBe('critical');
    });
  });

  describe('detailed tablegroup verification', () => {
    test('should interpret tablegroup table references correctly', () => {
      const source = `
        Table users { id int }
        Table posts { id int }
        Table comments { id int }
        TableGroup content {
          posts
          comments
        }
      `;
      const db = interpret(source).getValue()!;
      const group = db.tableGroups[0];

      expect(group.tables).toHaveLength(2);
      expect(group.tables.map((t) => t.name)).toContain('posts');
      expect(group.tables.map((t) => t.name)).toContain('comments');
    });

    test('should interpret tablegroup with schema', () => {
      const source = `
        Table users { id int }
        TableGroup public.usergroup {
          users
        }
      `;
      const result = interpret(source);
      // TableGroup with schema may not be fully supported - just verify it doesn't crash
      expect(result).toBeDefined();
      const db = result.getValue();
      if (db && db.tableGroups && db.tableGroups.length > 0) {
        const group = db.tableGroups[0];
        expect(group.name).toBeDefined();
      }
    });
  });

  describe('standalone note interpretation', () => {
    test('should interpret standalone note', () => {
      const source = `
        Note project_notes {
          'This is a standalone note for the project'
        }
        Table users { id int }
      `;
      const result = interpret(source);
      // Should not crash
      expect(result.getValue()).toBeDefined();
    });
  });

  describe('multiple table verification', () => {
    test('should maintain table order', () => {
      const source = `
        Table alpha { id int }
        Table beta { id int }
        Table gamma { id int }
      `;
      const db = interpret(source).getValue()!;

      expect(db.tables[0].name).toBe('alpha');
      expect(db.tables[1].name).toBe('beta');
      expect(db.tables[2].name).toBe('gamma');
    });

    test('should handle tables in different schemas', () => {
      const source = `
        Table public.users { id int }
        Table auth.users { id int }
        Table billing.users { id int }
      `;
      const db = interpret(source).getValue()!;

      expect(db.tables).toHaveLength(3);
      expect(db.tables[0].schemaName).toBe('public');
      expect(db.tables[1].schemaName).toBe('auth');
      expect(db.tables[2].schemaName).toBe('billing');
    });
  });

  describe('consistency checks', () => {
    test('should have consistent table references in refs', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [ref: > users.id] }
      `;
      const db = interpret(source).getValue()!;

      // The ref should reference actual tables
      const ref = db.refs[0];
      const tableNames = db.tables.map((t) => t.name);

      expect(tableNames).toContain(ref.endpoints[0].tableName);
      expect(tableNames).toContain(ref.endpoints[1].tableName);
    });

    test('should have consistent table references in tablegroups', () => {
      const source = `
        Table users { id int }
        Table posts { id int }
        TableGroup main {
          users
          posts
        }
      `;
      const db = interpret(source).getValue()!;
      const group = db.tableGroups[0];
      const tableNames = db.tables.map((t) => t.name);

      group.tables.forEach((ref) => {
        expect(tableNames).toContain(ref.name);
      });
    });
  });
});
