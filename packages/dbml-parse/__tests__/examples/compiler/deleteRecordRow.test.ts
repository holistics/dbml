import Compiler from '@/compiler/index';

describe('[example] deleteRecordRow', () => {
  describe('basic deletion', () => {
    test('should delete first row by index', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
  3, 'Charlie'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordRow('users', 0);

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
        }

        records users(id, name) {
          2, 'Bob'
          3, 'Charlie'
        }
        "
      `);
    });

    test('should delete middle row by index', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
  3, 'Charlie'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordRow('users', 1);

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
        }

        records users(id, name) {
          1, 'Alice'
          3, 'Charlie'
        }
        "
      `);
    });

    test('should delete last row by index', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
  3, 'Charlie'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordRow('users', 2);

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
  });

  describe('multiple Records blocks', () => {
    test('should count rows across multiple blocks', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}

records users(id, name) {
  3, 'Charlie'
  4, 'David'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordRow('users', 2); // First row of second block

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

        records users(id, name) {
          4, 'David'
        }
        "
      `);
    });

    test('should delete from correct block based on cumulative index', () => {
      const input = `
Table users {
  id int
}

records users(id) {
  1
}

records users(id) {
  2
  3
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordRow('users', 1);

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
        }

        records users(id) {
          1
        }

        records users(id) {
          3
        }
        "
      `);
    });
  });

  describe('edge cases', () => {
    test('should return unchanged source when index out of range', () => {
      const input = `
Table users {
  id int
}

records users(id) {
  1
  2
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordRow('users', 10);

      expect(result).toBe(input);
    });

    test('should return unchanged source when no Records exist', () => {
      const input = `
Table users {
  id int [pk]
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordRow('users', 0);

      expect(result).toBe(input);
    });

    test('should handle schema-qualified table names', () => {
      const input = `
Table auth.users {
  id int
}

records auth.users(id) {
  1
  2
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordRow('auth.users', 0);

      expect(result).toMatchInlineSnapshot(`
        "
        Table auth.users {
          id int
        }

        records auth.users(id) {
          2
        }
        "
      `);
    });

    test('should delete only row leaving empty block', () => {
      const input = `
Table users {
  id int
}

records users(id) {
  1
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.deleteRecordRow('users', 0);

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
        }
        "
      `);
    });
  });
});
