import Compiler from '@/compiler/index';

describe('[example] removeAllRecords', () => {
  describe('basic removal', () => {
    test('should remove single Records block', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.removeAllRecords('users');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
        }
        "
      `);
    });

    test('should remove all Records blocks for a table', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
}

records users(id, name) {
  1, 'Alice'
}

records users(id, name) {
  2, 'Bob'
}

records users(id, name) {
  3, 'Charlie'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.removeAllRecords('users');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
        }
        "
      `);
    });

    test('should remove Records without body', () => {
      const input = `
Table users {
  id int
}

records users(id)

records users(id) {
  1
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.removeAllRecords('users');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
        }
        "
      `);
    });
  });

  describe('selective removal', () => {
    test('should only remove Records for specified table', () => {
      const input = `
Table users {
  id int
}

Table posts {
  id int
}

records users(id) {
  1
}

records posts(id) {
  100
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.removeAllRecords('users');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
        }

        Table posts {
          id int
        }

        records posts(id) {
          100
        }
        "
      `);
    });

    test('should handle schema-qualified tables separately', () => {
      const input = `
Table users {
  id int
}

Table auth.users {
  id int
}

records users(id) {
  1
}

records auth.users(id) {
  2
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.removeAllRecords('users');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
        }

        Table auth.users {
          id int
        }

        records auth.users(id) {
          2
        }
        "
      `);
    });
  });

  describe('edge cases', () => {
    test('should return unchanged source when no Records exist', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.removeAllRecords('users');

      expect(result).toBe(input);
    });

    test('should handle schema-qualified table names', () => {
      const input = `
Table auth.users {
  id int
}

records auth.users(id) {
  1
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.removeAllRecords('auth.users');

      expect(result).toMatchInlineSnapshot(`
        "
        Table auth.users {
          id int
        }
        "
      `);
    });

    test('should clean up extra blank lines', () => {
      const input = `
Table users {
  id int
}

records users(id) {
  1
}


records users(id) {
  2
}


Table posts {
  id int
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.removeAllRecords('users');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
        }


        Table posts {
          id int
        }
        "
      `);
    });

    test('should handle object-style table name input', () => {
      const input = `
Table auth.users {
  id int
}

records auth.users(id) {
  1
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.removeAllRecords({ schema: 'auth', table: 'users' });

      expect(result).toMatchInlineSnapshot(`
        "
        Table auth.users {
          id int
        }
        "
      `);
    });

    test('should preserve other elements when removing Records', () => {
      const input = `
Table users {
  id int
  indexes {
    id [pk]
  }
}

records users(id) {
  1
}

Ref: posts.user_id > users.id
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.removeAllRecords('users');

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
          indexes {
            id [pk]
          }
        }

        Ref: posts.user_id > users.id
        "
      `);
    });
  });
});
