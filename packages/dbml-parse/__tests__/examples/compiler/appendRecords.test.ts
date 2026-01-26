import Compiler from '@/compiler/index';

describe('[example] appendRecords', () => {
  describe('basic functionality', () => {
    test('should append new records block to empty source', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['id', 'name'],
        [
          [{ value: 1, type: 'integer' }, { value: 'Alice', type: 'string' }],
          [{ value: 2, type: 'integer' }, { value: 'Bob', type: 'string' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
        }

        records users(id, name) {
          1, 'Alice'
          2, 'Bob'
        }
        "
      `);
    });

    test('should handle schema-qualified table names', () => {
      const input = `
Table auth.users {
  id int [pk]
  email varchar
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'auth.users',
        ['id', 'email'],
        [
          [{ value: 1, type: 'integer' }, { value: 'alice@example.com', type: 'string' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table auth.users {
          id int [pk]
          email varchar
        }

        records auth.users(id, email) {
          1, 'alice@example.com'
        }
        "
      `);
    });

    test('should handle object-style table name input', () => {
      const input = `
Table users {
  id int [pk]
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        { table: 'users' },
        ['id'],
        [
          [{ value: 1, type: 'integer' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
        }

        records users(id) {
          1
        }
        "
      `);
    });

    test('should handle object-style with schema', () => {
      const input = `
Table auth.users {
  id int [pk]
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        { schema: 'auth', table: 'users' },
        ['id'],
        [
          [{ value: 1, type: 'integer' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table auth.users {
          id int [pk]
        }

        records auth.users(id) {
          1
        }
        "
      `);
    });
  });

  describe('merging into existing records', () => {
    test('should merge into last records block with matching columns', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
  email varchar
}

records users(id, name, email) {
  1, 'Alice', 'alice@example.com'
  2, 'Bob', 'bob@example.com'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['id', 'name'],
        [
          [{ value: 3, type: 'integer' }, { value: 'Charlie', type: 'string' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
          email varchar
        }

        records users(id, name, email) {
          1, 'Alice', 'alice@example.com'
          2, 'Bob', 'bob@example.com'

          3, 'Charlie', null
        }
        "
      `);
    });

    test('should fill missing columns with null when merging', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
  email varchar
  age int
}

records users(id, name, email, age) {
  1, 'Alice', 'alice@example.com', 30
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['id', 'name'],
        [
          [{ value: 2, type: 'integer' }, { value: 'Bob', type: 'string' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
          email varchar
          age int
        }

        records users(id, name, email, age) {
          1, 'Alice', 'alice@example.com', 30

          2, 'Bob', null, null
        }
        "
      `);
    });

    test('should create new block if last records missing target columns', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
  email varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['id', 'email'],
        [
          [{ value: 3, type: 'integer' }, { value: 'charlie@example.com', type: 'string' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
          email varchar
        }

        records users(id, name) {
          1, 'Alice'
          2, 'Bob'
        }

        records users(id, email) {
          3, 'charlie@example.com'
        }
        "
      `);
    });

    test('should not merge into records block without body', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
}

records users(id, name)
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['id', 'name'],
        [
          [{ value: 1, type: 'integer' }, { value: 'Alice', type: 'string' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
        }

        records users(id, name)

        records users(id, name) {
          1, 'Alice'
        }
        "
      `);
    });

    test('should only check last records block for merging', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
  email varchar
}

records users(id, name, email) {
  1, 'Alice', 'alice@example.com'
}

records users(id, name) {
  2, 'Bob'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['id', 'name'],
        [
          [{ value: 3, type: 'integer' }, { value: 'Charlie', type: 'string' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
          email varchar
        }

        records users(id, name, email) {
          1, 'Alice', 'alice@example.com'
        }

        records users(id, name) {
          2, 'Bob'

          3, 'Charlie'
        }
        "
      `);
    });
  });

  describe('data type formatting', () => {
    test('should format integer values', () => {
      const input = 'Table users { id int }';
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['id'],
        [
          [{ value: 1, type: 'integer' }],
          [{ value: -42, type: 'integer' }],
          [{ value: 0, type: 'integer' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "Table users { id int }
        records users(id) {
          1
          -42
          0
        }
        "
      `);
    });

    test('should format boolean values', () => {
      const input = 'Table users { active bool }';
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['active'],
        [
          [{ value: true, type: 'bool' }],
          [{ value: false, type: 'bool' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "Table users { active bool }
        records users(active) {
          true
          false
        }
        "
      `);
    });

    test('should format string values with single quotes', () => {
      const input = 'Table users { name varchar }';
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['name'],
        [
          [{ value: 'Alice', type: 'string' }],
          [{ value: 'Bob Smith', type: 'string' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "Table users { name varchar }
        records users(name) {
          'Alice'
          'Bob Smith'
        }
        "
      `);
    });

    test('should format null values', () => {
      const input = 'Table users { email varchar }';
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['email'],
        [
          [{ value: null, type: 'string' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "Table users { email varchar }
        records users(email) {
          null
        }
        "
      `);
    });

    test('should format datetime values', () => {
      const input = 'Table events { created_at timestamp }';
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'events',
        ['created_at'],
        [
          [{ value: '2024-01-15 10:30:00', type: 'timestamp' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "Table events { created_at timestamp }
        records events(created_at) {
          '2024-01-15T10:30:00.000+07:00'
        }
        "
      `);
    });

    test('should format expression values with backticks', () => {
      const input = 'Table users { created_at timestamp }';
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords(
        'users',
        ['created_at'],
        [
          [{ value: 'now()', type: 'expression' }],
        ],
      );

      expect(result).toMatchInlineSnapshot(`
        "Table users { created_at timestamp }
        records users(created_at) {
          \`now()\`
        }
        "
      `);
    });
  });

  describe('error handling', () => {
    test('should throw error when columns array is empty', () => {
      const compiler = new Compiler();
      compiler.setSource('Table users { id int }');

      expect(() => {
        compiler.appendRecords('users', [], []);
      }).toThrow('Columns must not be empty');
    });

    test('should return unchanged source when values array is empty', () => {
      const input = 'Table users { id int }';
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.appendRecords('users', ['id'], []);

      expect(result).toBe(input);
    });

    test('should throw error when row has mismatched column count', () => {
      const compiler = new Compiler();
      compiler.setSource('Table users { id int, name varchar }');

      expect(() => {
        compiler.appendRecords('users', ['id', 'name'], [
          [{ value: 1, type: 'integer' }], // Only 1 value but 2 columns
        ]);
      }).toThrow('Data record entry does not have the same columns');
    });
  });
});
