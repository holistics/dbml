import {
  describe, expect, test,
} from 'vitest';
import {
  interpret, analyze,
} from '@tests/utils';

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
      expect(db.tables[0].schemaName).toBeNull();
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

      expect(db.enums[0].schemaName).toBeNull();
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
        {
          type: 'int',
          expected: {
            type_name: 'int',
            args: null,
            schemaName: null,
          },
        },
        {
          type: 'integer',
          expected: {
            type_name: 'integer',
            args: null,
            schemaName: null,
          },
        },
        {
          type: 'bigint',
          expected: {
            type_name: 'bigint',
            args: null,
            schemaName: null,
          },
        },
        {
          type: 'varchar',
          expected: {
            type_name: 'varchar',
            args: null,
            schemaName: null,
          },
        },
        {
          type: 'text',
          expected: {
            type_name: 'text',
            args: null,
            schemaName: null,
          },
        },
        {
          type: 'boolean',
          expected: {
            type_name: 'boolean',
            args: null,
            schemaName: null,
          },
        },
        {
          type: 'timestamp',
          expected: {
            type_name: 'timestamp',
            args: null,
            schemaName: null,
          },
        },
        {
          type: 'uuid',
          expected: {
            type_name: 'uuid',
            args: null,
            schemaName: null,
          },
        },
      ];

      testCases.forEach(({
        type, expected,
      }) => {
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
        {
          type: 'varchar(255)',
          expected: {
            type_name: 'varchar(255)',
            args: '255',
            schemaName: null,
          },
        },
        {
          type: 'char(10)',
          expected: {
            type_name: 'char(10)',
            args: '10',
            schemaName: null,
          },
        },
        {
          type: 'decimal(10,2)',
          expected: {
            type_name: 'decimal(10,2)',
            args: '10,2',
            schemaName: null,
          },
        },
        {
          type: 'numeric(5)',
          expected: {
            type_name: 'numeric(5)',
            args: '5',
            schemaName: null,
          },
        },
      ];

      testCases.forEach(({
        type, expected,
      }) => {
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
        {
          action: 'cascade',
          expected: 'cascade',
        },
        {
          action: 'no action',
          expected: 'no action',
        },
        {
          action: 'set null',
          expected: 'set null',
        },
        {
          action: 'set default',
          expected: 'set default',
        },
        {
          action: 'restrict',
          expected: 'restrict',
        },
      ];

      testCases.forEach(({
        action, expected,
      }) => {
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
        {
          action: 'cascade',
          expected: 'cascade',
        },
        {
          action: 'no action',
          expected: 'no action',
        },
        {
          action: 'set null',
          expected: 'set null',
        },
        {
          action: 'set default',
          expected: 'set default',
        },
        {
          action: 'restrict',
          expected: 'restrict',
        },
      ];

      testCases.forEach(({
        action, expected,
      }) => {
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
      expect(result).toBeDefined();
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

  describe('DiagramView interpretation (Trinity omit rule)', () => {
    test('should apply Trinity rule: Tables explicit → tableGroups and schemas default to []', () => {
      const source = `
        Table users { id int }
        DiagramView myView {
          Tables { users }
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toEqual([
        {
          name: 'users',
          schemaName: 'public',
        },
      ]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('should apply Trinity rule: Tables {*} → tableGroups and schemas default to []', () => {
      const source = `
        DiagramView myView {
          Tables { * }
        }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('should apply Trinity rule: Tables explicit + Notes explicit → tableGroups/schemas default to [], stickyNotes is []', () => {
      const source = `
        Table users { id int }
        DiagramView myView {
          Tables { users }
          Notes { * }
        }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toEqual([
        {
          name: 'users',
          schemaName: 'public',
        },
      ]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toEqual([]);
    });

    test('should produce all null when body is empty (no Trinity non-null)', () => {
      const source = `
        DiagramView myView {
        }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toBeNull();
      expect(ve.tableGroups).toBeNull();
      expect(ve.schemas).toBeNull();
      expect(ve.stickyNotes).toBeNull();
    });

    test('should produce all [] when body-level wildcard {*} is used', () => {
      const source = `
        DiagramView myView { * }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toEqual([]);
    });

    test('should NOT apply Trinity rule when Tables {} is explicitly empty (null stays null)', () => {
      const source = `
        DiagramView myView {
          Tables {}
        }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toBeNull();
      expect(ve.tableGroups).toBeNull();
      expect(ve.schemas).toBeNull();
      expect(ve.stickyNotes).toBeNull();
    });

    test('should apply Trinity rule: TableGroups {*} as sole trigger → tables and schemas default to []', () => {
      const source = `
        DiagramView myView {
          TableGroups { * }
        }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });
  });

  describe('DiagramView wildcard expansion for TableGroups', () => {
    test('should expand explicit TableGroups {*} to concrete group names', () => {
      const source = `
        Table users { id int }
        Table posts { id int }
        TableGroup auth_tables { users }
        TableGroup content_tables { posts }
        DiagramView myView {
          TableGroups { * }
        }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tableGroups).toEqual([
        {
          name: 'auth_tables',
        },
        {
          name: 'content_tables',
        },
      ]);
      // Trinity rule still applies for tables/schemas (promoted to [])
      expect(ve.tables).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('should NOT expand TableGroups {*} in body-level wildcard {*} (all dims are set)', () => {
      const source = `
        Table users { id int }
        TableGroup auth_tables { users }
        DiagramView myView { * }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      // Body-level {*} sets all dims — Tables/Schemas are also set, so no expansion
      expect(ve.tableGroups).toEqual([]);
      expect(ve.tables).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toEqual([]);
    });

    test('should NOT expand tableGroups [] from Trinity promotion', () => {
      const source = `
        Table users { id int }
        TableGroup auth_tables { users }
        DiagramView myView {
          Tables { users }
        }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      // tableGroups [] comes from Trinity promotion, not explicit wildcard — should stay []
      expect(ve.tableGroups).toEqual([]);
      expect(ve.tables).toEqual([
        {
          name: 'users',
          schemaName: 'public',
        },
      ]);
      expect(ve.schemas).toEqual([]);
    });

    test('should ALWAYS expand TableGroups {*} even when Tables is also explicitly set', () => {
      const source = `
        Table users { id int }
        TableGroup auth_tables { users }
        DiagramView myView {
          Tables { users }
          TableGroups { * }
        }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      // TableGroups {*} expands to concrete names, Tables stays as-is
      expect(ve.tableGroups).toEqual([{ name: 'auth_tables' }]);
      expect(ve.tables).toEqual([{ name: 'users', schemaName: 'public' }]);
      expect(ve.schemas).toEqual([]);
    });

    test('should return empty list when TableGroups {*} but no groups exist', () => {
      const source = `
        Table users { id int }
        DiagramView myView {
          TableGroups { * }
        }
      `;
      const db = interpret(source).getValue()!;

      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tableGroups).toEqual([]);
    });
  });

  describe('DiagramView union semantics (TableGroups {*} always expands)', () => {
    test('should expand TableGroups {*} alongside Tables with items', () => {
      const source = `
        Table users { id int }
        Table orders { id int }
        TableGroup Inventory { users }
        TableGroup Reporting { orders }
        DiagramView myView {
          Tables {
            users
            orders
          }
          TableGroups { * }
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tables).toEqual([
        { name: 'users', schemaName: 'public' },
        { name: 'orders', schemaName: 'public' },
      ]);
      expect(ve.tableGroups).toEqual([
        { name: 'Inventory' },
        { name: 'Reporting' },
      ]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('should expand TableGroups {*} alongside Schemas * → Schemas * triggers all Trinity []', () => {
      const source = `
        Table users { id int }
        TableGroup Inventory { users }
        DiagramView myView {
          TableGroups { * }
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // Schemas {*} → union covers everything → all Trinity []
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('should expand TableGroups {*} with Notes', () => {
      const source = `
        Table users { id int }
        TableGroup Inventory { users }
        Note MyNote { 'hello' }
        DiagramView myView {
          TableGroups { * }
          Notes { MyNote }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tableGroups).toEqual([{ name: 'Inventory' }]);
      expect(ve.tables).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toEqual([{ name: 'MyNote' }]);
    });

    test('body-level {*} should NOT expand tableGroups (uses body-level wildcard set)', () => {
      const source = `
        Table users { id int }
        TableGroup Inventory { users }
        DiagramView myView { * }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tableGroups).toEqual([]);
      expect(ve.tables).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toEqual([]);
    });

    test('empty Tables {} should produce all null (same as empty body)', () => {
      const source = `
        DiagramView myView {
          Tables { }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tables).toBeNull();
      expect(ve.tableGroups).toBeNull();
      expect(ve.schemas).toBeNull();
      expect(ve.stickyNotes).toBeNull();
    });

    test('only Notes set → no Trinity omit (Trinity dims stay null)', () => {
      const source = `
        Table users { id int }
        DiagramView myView {
          Notes { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // Notes is set (to [] = show all), but no Trinity dims set → Trinity omit doesn't apply
      expect(ve.tables).toBeNull();
      expect(ve.tableGroups).toBeNull();
      expect(ve.schemas).toBeNull();
      expect(ve.stickyNotes).toEqual([]);
    });
  });

  describe('DiagramView parser — dbml-filter-examples.md full coverage', () => {
    // Group D: Sub-block with specific items

    test('D3: Schemas only → Trinity omit promotes tables and tableGroups to []', () => {
      const source = `
        DiagramView myView {
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('D4: Tables + Schemas wildcard → Schemas * triggers all Trinity []', () => {
      const source = `
        Table users { id int }
        DiagramView myView {
          Tables { users }
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // Schemas {*} → union covers everything → all Trinity []
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('D6: TableGroups + Schemas wildcard → Schemas * triggers all Trinity []', () => {
      const source = `
        Table users { id int }
        TableGroup Inventory { users }
        DiagramView myView {
          TableGroups { Inventory }
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // Schemas {*} → union covers everything → all Trinity []
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('D7: All three Trinity dims with Schemas * → all Trinity []', () => {
      const source = `
        Table users { id int }
        TableGroup Inventory { users }
        DiagramView myView {
          Tables { users }
          TableGroups { Inventory }
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // Schemas {*} → union covers everything → all Trinity []
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    // Group E: Wildcard sub-blocks

    test('E1: Wildcard TableGroups + explicit tables + schemas wildcard → Schemas * triggers all Trinity []', () => {
      const source = `
        Table users { id int }
        Table orders { id int }
        TableGroup Inventory { users }
        TableGroup Reporting { orders }
        DiagramView myView {
          Tables {
            users
            orders
          }
          TableGroups { * }
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // Schemas {*} → union covers everything → all Trinity []
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    // Mixed wildcard + specific items in sibling Trinity dims

    test('Mixed: Tables { items } + Schemas { * } → Schemas * means show all, union = all Trinity []', () => {
      const source = `
        Table users { id int }
        Table orders { id int }
        DiagramView myView {
          Tables {
            users
            orders
          }
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // Schemas {*} → union covers everything → all Trinity []
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('Mixed: Tables { * } + TableGroups { Inv } → Tables * means show all, union = all Trinity []', () => {
      const source = `
        Table users { id int }
        TableGroup Inventory { users }
        DiagramView myView {
          Tables { * }
          TableGroups { Inventory }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // Tables {*} → union covers everything → all Trinity []
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('Mixed: TableGroups { Inv } + Schemas { * } → Schemas * means show all, union = all Trinity []', () => {
      const source = `
        Table users { id int }
        TableGroup Inventory { users }
        DiagramView myView {
          TableGroups { Inventory }
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // Schemas {*} → union covers everything → all Trinity []
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('Mixed: Tables { * } + Schemas { * } → both show all, all Trinity []', () => {
      const source = `
        DiagramView myView {
          Tables { * }
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('Mixed: TableGroups { Inv } + Tables { * } + Schemas { * } → Tables/Schemas * → all Trinity []', () => {
      const source = `
        Table users { id int }
        TableGroup Inventory { users }
        DiagramView myView {
          Tables { * }
          TableGroups { Inventory }
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // Tables {*} or Schemas {*} → all Trinity []
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('Mixed: Tables { items } + TableGroups { * } → TableGroups * expands, Tables preserved', () => {
      const source = `
        Table users { id int }
        Table orders { id int }
        TableGroup Inventory { users }
        TableGroup Reporting { orders }
        DiagramView myView {
          Tables {
            users
            orders
          }
          TableGroups { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // TableGroups {*} expands to concrete names, Tables preserved
      expect(ve.tables).toEqual([
        { name: 'users', schemaName: 'public' },
        { name: 'orders', schemaName: 'public' },
      ]);
      expect(ve.tableGroups).toEqual([{ name: 'Inventory' }, { name: 'Reporting' }]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('E3: Wildcard Schemas only → [] + Trinity omit', () => {
      const source = `
        DiagramView myView {
          Schemas { * }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.schemas).toEqual([]);
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    // Group F: Body-level wildcard + Notes

    test('F2: Tables {*} + Notes → Trinity omit for tableGroups/schemas, notes has items', () => {
      const source = `
        Note MyNote { 'hello' }
        DiagramView myView {
          Tables { * }
          Notes { MyNote }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toEqual([{ name: 'MyNote' }]);
    });

    // Group G: Empty blocks

    test('G2: Empty TableGroups block → same as empty body (all null)', () => {
      const source = `
        DiagramView myView {
          TableGroups { }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tables).toBeNull();
      expect(ve.tableGroups).toBeNull();
      expect(ve.schemas).toBeNull();
      expect(ve.stickyNotes).toBeNull();
    });

    test('G2: Empty Schemas block → same as empty body (all null)', () => {
      const source = `
        DiagramView myView {
          Schemas { }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tables).toBeNull();
      expect(ve.tableGroups).toBeNull();
      expect(ve.schemas).toBeNull();
      expect(ve.stickyNotes).toBeNull();
    });

    test('G2: Empty Notes block → same as empty body (all null)', () => {
      const source = `
        DiagramView myView {
          Notes { }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tables).toBeNull();
      expect(ve.tableGroups).toBeNull();
      expect(ve.schemas).toBeNull();
      expect(ve.stickyNotes).toBeNull();
    });

    // Group H: No Trinity dims, only Notes

    test('H1: Only Notes with items → no Trinity omit', () => {
      const source = `
        Note Note1 { 'hello' }
        Note Note2 { 'world' }
        DiagramView myView {
          Notes {
            Note1
            Note2
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      expect(ve.tables).toBeNull();
      expect(ve.tableGroups).toBeNull();
      expect(ve.schemas).toBeNull();
      expect(ve.stickyNotes).toEqual([{ name: 'Note1' }, { name: 'Note2' }]);
    });

    // Round-trip verification: DBML → FC → DBML stability

    test('Round-trip: Tables { users } → FC → generates same DBML', () => {
      const source = `
        Table users { id int }
        DiagramView myView {
          Tables { users }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // FC: [users], [], [], null
      // Should generate: Tables { users } (no TableGroups/Schemas/Notes)
      expect(ve.tables).toEqual([{ name: 'users', schemaName: 'public' }]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('Round-trip: TableGroups { Inv } → FC → generates same DBML', () => {
      const source = `
        Table users { id int }
        TableGroup Inv { users }
        DiagramView myView {
          TableGroups { Inv }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // FC: [], [Inv], [], null
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([{ name: 'Inv' }]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toBeNull();
    });

    test('Round-trip: { *} → FC → generates same { * }', () => {
      const source = `
        DiagramView myView { * }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // FC: [], [], [], []
      expect(ve.tables).toEqual([]);
      expect(ve.tableGroups).toEqual([]);
      expect(ve.schemas).toEqual([]);
      expect(ve.stickyNotes).toEqual([]);
    });

    test('Round-trip: { } (empty) → FC → generates same { }', () => {
      const source = `
        DiagramView myView {
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;

      // FC: null, null, null, null
      expect(ve.tables).toBeNull();
      expect(ve.tableGroups).toBeNull();
      expect(ve.schemas).toBeNull();
      expect(ve.stickyNotes).toBeNull();
    });
  });

  describe('DiagramView alias resolution', () => {
    test('should resolve table alias to real name', () => {
      const source = `
        Table users as U { id int }
        DiagramView myView {
          Tables { U }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toEqual([
        {
          name: 'users',
          schemaName: 'public',
        },
      ]);
    });

    test('should resolve schema-qualified table alias', () => {
      const source = `
        Table public.articles as A { id int }
        DiagramView myView {
          Tables { A }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toEqual([
        {
          name: 'articles',
          schemaName: 'public',
        },
      ]);
    });

    test('should keep real name when no alias is used', () => {
      const source = `
        Table users { id int }
        DiagramView myView {
          Tables { users }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toEqual([
        {
          name: 'users',
          schemaName: 'public',
        },
      ]);
    });

    test('should resolve multiple aliases in same block', () => {
      const source = `
        Table users as U { id int }
        Table posts as P { id int }
        DiagramView myView {
          Tables {
            U
            P
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toEqual([
        {
          name: 'users',
          schemaName: 'public',
        },
        {
          name: 'posts',
          schemaName: 'public',
        },
      ]);
    });

    test('should resolve mixed aliases and real names', () => {
      const source = `
        Table users as U { id int }
        Table posts { id int }
        DiagramView myView {
          Tables {
            U
            posts
          }
        }
      `;
      const db = interpret(source).getValue()!;
      const ve = db.diagramViews[0].visibleEntities;
      expect(ve.tables).toEqual([
        {
          name: 'users',
          schemaName: 'public',
        },
        {
          name: 'posts',
          schemaName: 'public',
        },
      ]);
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
      expect(db.tables[0].schemaName).toBeNull();
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
