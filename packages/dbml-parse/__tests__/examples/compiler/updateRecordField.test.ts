import Compiler from '@/compiler/index';

describe('[example] updateRecordField', () => {
  describe('updating existing field', () => {
    test('should update field value when field exists', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
  status varchar
}

records users(id, name, status) {
  1, 'Alice', 'active'
  2, 'Bob', 'inactive'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.updateRecordField(
        'users',
        0,
        'status',
        { value: 'pending', type: 'string' },
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
          status varchar
        }

        records users(id, name, status) {
          1, 'Alice', 'pending'
          2, 'Bob', 'inactive'
        }
        "
      `);
    });

    test('should update field in multiple Records blocks', () => {
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
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.updateRecordField(
        'users',
        1,
        'name',
        { value: 'Updated', type: 'string' },
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int [pk]
          name varchar
        }

        records users(id, name) {
          1, 'Alice'
        }

        records users(id, name) {
          2, 'Updated'
        }
        "
      `);
    });

    test('should handle different data types', () => {
      const input = `
Table products {
  id int
  price decimal
}

records products(id, price) {
  1, 99.99
  2, 149.50
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.updateRecordField(
        'products',
        0,
        'price',
        { value: 0, type: 'integer' },
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table products {
          id int
          price decimal
        }

        records products(id, price) {
          1, 0
          2, 149.50
        }
        "
      `);
    });
  });

  describe('field not found', () => {
    test('should return unchanged source when field does not exist', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
  status varchar
}

records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.updateRecordField(
        'users',
        0,
        'status',
        { value: 'active', type: 'string' },
      );

      expect(result).toBe(input);
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
      const result = compiler.updateRecordField(
        'users',
        0,
        'name',
        { value: 'Test', type: 'string' },
      );

      expect(result).toBe(input);
    });

    test('should handle schema-qualified table names', () => {
      const input = `
Table auth.users {
  id int
  name varchar
}

records auth.users(id, name) {
  1, 'Alice'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.updateRecordField(
        'auth.users',
        0,
        'name',
        { value: 'Updated', type: 'string' },
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table auth.users {
          id int
          name varchar
        }

        records auth.users(id, name) {
          1, 'Updated'
        }
        "
      `);
    });

    test('should handle null values', () => {
      const input = `
Table users {
  id int
  email varchar
}

records users(id, email) {
  1, 'alice@example.com'
}
`;
      const compiler = new Compiler();
      compiler.setSource(input);
      const result = compiler.updateRecordField(
        'users',
        0,
        'email',
        { value: null, type: 'string' },
      );

      expect(result).toMatchInlineSnapshot(`
        "
        Table users {
          id int
          email varchar
        }

        records users(id, email) {
          1, null
        }
        "
      `);
    });
  });
});
