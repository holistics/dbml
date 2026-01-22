import Compiler from '@/compiler/index';

describe('[example] deleteRecordValue', () => {
  describe('basic deletion', () => {
    test('should set value to null at specified row and column', () => {
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
      const result = compiler.deleteRecordValue('users', 0, 'email');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
          email varchar
        }

        records users(id, name, email) {
          1, 'Alice', null
          2, 'Bob', 'bob@example.com'
        }
        "
      `);
    });

    test('should delete value in middle column', () => {
      const input = `
Table users {
  id int
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
      const result = compiler.deleteRecordValue('users', 1, 'name');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
          name varchar
          email varchar
        }

        records users(id, name, email) {
          1, 'Alice', 'alice@example.com'
          2, null, 'bob@example.com'
        }
        "
      `);
    });

    test('should delete value in first column', () => {
      const input = `
Table users {
  id int
  name varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordValue('users', 1, 'id');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
          name varchar
        }

        records users(id, name) {
          1, 'Alice'
          null, 'Bob'
        }
        "
      `);
    });
  });

  describe('multiple Records blocks', () => {
    test('should count rows across blocks for correct deletion', () => {
      const input = `
Table users {
  id int
  name varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}

records users(id, name) {
  3, 'Charlie'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordValue('users', 2, 'name');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
          name varchar
        }

        records users(id, name) {
          1, 'Alice'
          2, 'Bob'
        }

        records users(id, name) {
          3, null
        }
        "
      `);
    });

    test('should only affect specified block when deleting', () => {
      const input = `
Table users {
  id int
  name varchar
}

records users(id, name) {
  1, 'Alice'
}

records users(id, name) {
  2, 'Bob'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordValue('users', 0, 'name');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
          name varchar
        }

        records users(id, name) {
          1, null
        }

        records users(id, name) {
          2, 'Bob'
        }
        "
      `);
    });
  });

  describe('edge cases', () => {
    test('should return unchanged source when row index out of range', () => {
      const input = `
Table users {
  id int
  name varchar
}

records users(id, name) {
  1, 'Alice'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordValue('users', 10, 'name');

      expect(result).toBe(input);
    });

    test('should return unchanged source when column not found', () => {
      const input = `
Table users {
  id int
  name varchar
}

records users(id, name) {
  1, 'Alice'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordValue('users', 0, 'nonexistent');

      expect(result).toBe(input);
    });

    test('should return unchanged source when no Records exist', () => {
      const input = `
Table users {
  id int
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordValue('users', 0, 'id');

      expect(result).toBe(input);
    });

    test('should handle schema-qualified table names', () => {
      const input = `
Table auth.users {
  id int
  email varchar
}

records auth.users(id, email) {
  1, 'alice@example.com'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordValue('auth.users', 0, 'email');

      expect(result).toMatchInlineSnapshot(`
        "
        Table auth.users {
          id int
          email varchar
        }

        records auth.users(id, email) {
          1, null
        }
        "
      `);
    });
  });
});
