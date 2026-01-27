import { CompileErrorCode } from '@/index';
import { interpret } from '@tests/utils';

describe('[example - record] multiple records blocks', () => {
  test('should handle multiple records blocks for the same table with different columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        age int
        email varchar
      }

      records users(id, name) {
        1, 'Alice'
        2, 'Bob'
      }

      records users(id, age) {
        3, 25
        4, 30
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('users');
    expect(record.columns).toEqual(['id', 'name']);
    expect(record.values.length).toBe(4);

    // Verify ALL rows and ALL columns in each row
    // First row: (1, 'Alice')
    expect(record.values[0].length).toBe(2);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'Alice' });

    // Second row: (2, 'Bob')
    expect(record.values[1].length).toBe(2);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(record.values[1][1]).toEqual({ type: 'string', value: 'Bob' });

    // Third row: (3, null) - from records users(id, age), maps to ['id', 'name']
    expect(record.values[2].length).toBe(2);
    expect(record.values[2][0]).toEqual({ type: 'integer', value: 3 });
    expect(record.values[2][1]).toEqual({ type: 'expression', value: null });

    // Fourth row: (4, null)
    expect(record.values[3].length).toBe(2);
    expect(record.values[3][0]).toEqual({ type: 'integer', value: 4 });
    expect(record.values[3][1]).toEqual({ type: 'expression', value: null });
  });

  test('should handle multiple records blocks, one with explicit columns and one without', () => {
    const source = `
      Table posts {
        id int [pk]
        title varchar
        content text
      }

      records posts(id, title) {
        1, 'First post'
      }

      records posts(id, title, content) {
        2, 'Second post', 'Content of second post'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('posts');
    expect(record.columns).toEqual(['id', 'title']);
    expect(record.values.length).toBe(2);

    // Verify ALL rows and ALL columns in each row
    // First row: (1, 'First post')
    expect(record.values[0].length).toBe(2);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'First post' });

    // Second row: (2, 'Second post') - from records(id, title, content), maps to ['id', 'title']
    expect(record.values[1].length).toBe(2);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(record.values[1][1]).toEqual({ type: 'string', value: 'Second post' });
  });

  test('should report error for inconsistent column count in implicit records', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        price decimal
      }

      records products(id, name) {
        1, 'Laptop'
      }

      records products(id, name) {
        2, 'Mouse' // Has 2 values for 2 columns - this is valid
      }

      records products(id, name, price) {
        3, 'Keyboard' // Missing price - only 2 values for 3 columns
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(errors[0].diagnostic).toBe('Expected 3 values but got 2');
  });
});

describe('[example - record] nested and top-level records mixed', () => {
  test('should handle records inside table with explicit columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar

        records (id, name) {
          1, 'Alice'
          2, 'Bob'
        }
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].columns).toEqual(['id', 'name']);
    expect(db.records[0].values).toHaveLength(2);
  });

  test('should handle records inside table without explicit columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar

        records {
          1, 'Alice', 'alice@example.com'
          2, 'Bob', 'bob@example.com'
        }
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].columns).toEqual(['id', 'name', 'email']);
    expect(db.records[0].values).toHaveLength(2);
  });

  test('should mix nested and top-level records for same table', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar

        records (id, name) {
          1, 'Alice'
        }
      }

      records users(id, email) {
        2, 'bob@example.com'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('users');
    expect(record.columns).toEqual(['id', 'name']);
    expect(record.values.length).toBe(2);

    // Verify ALL rows and ALL columns in each row
    // First row: (1, 'Alice')
    expect(record.values[0].length).toBe(2);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'Alice' });

    // Second row: (2, null) - from records(id, email), maps to ['id', 'name']
    expect(record.values[1].length).toBe(2);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(record.values[1][1]).toEqual({ type: 'expression', value: null });
  });

  test('should merge multiple nested records blocks with same columns', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        price decimal

        records (id, name) {
          1, 'Laptop'
        }

        records (id, name) {
          2, 'Mouse'
        }
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('products');
    expect(record.columns).toEqual(['id', 'name']);
    expect(record.values.length).toBe(2);

    // Verify ALL rows and ALL columns in each row
    // First row: (1, 'Laptop')
    expect(record.values[0].length).toBe(2);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'Laptop' });

    // Second row: (2, 'Mouse')
    expect(record.values[1].length).toBe(2);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(record.values[1][1]).toEqual({ type: 'string', value: 'Mouse' });
  });

  test('should merge nested records blocks with different columns', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        price decimal

        records (id, name) {
          1, 'Laptop'
        }

        records (id, price) {
          2, 999.99
        }
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('products');
    expect(record.columns).toEqual(['id', 'name']);
    expect(record.values.length).toBe(2);

    // Verify ALL rows and ALL columns in each row
    // First row: (1, 'Laptop')
    expect(record.values[0].length).toBe(2);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'Laptop' });

    // Second row: (2, null) - from (id, price), maps to ['id', 'name']
    expect(record.values[1].length).toBe(2);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(record.values[1][1]).toEqual({ type: 'expression', value: null });
  });

  test('should handle complex mix of nested, top-level, with and without columns', () => {
    const source = `
      Table orders {
        id int [pk]
        user_id int
        total decimal
        status varchar

        records (id, user_id) {
          1, 100
        }

        records {
          2, 101, 250.50, 'pending'
        }
      }

      records orders(id, total) {
        3, 500.00
      }

      records orders(id, status) {
        4, 'completed'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('orders');
    expect(record.columns).toEqual(['id', 'user_id']);
    expect(record.values.length).toBe(4);

    // Verify ALL rows and ALL columns in each row
    // First row: (1, 100)
    expect(record.values[0].length).toBe(2);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(record.values[0][1]).toEqual({ type: 'integer', value: 100 });

    // Second row: (2, 101) - from implicit columns, maps to ['id', 'user_id']
    expect(record.values[1].length).toBe(2);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(record.values[1][1]).toEqual({ type: 'integer', value: 101 });

    // Third row: (3, null) - from records(id, total), maps to ['id', 'user_id']
    expect(record.values[2].length).toBe(2);
    expect(record.values[2][0]).toEqual({ type: 'integer', value: 3 });
    expect(record.values[2][1]).toEqual({ type: 'expression', value: null });

    // Fourth row: (4, null) - from records(id, status), maps to ['id', 'user_id']
    expect(record.values[3].length).toBe(2);
    expect(record.values[3][0]).toEqual({ type: 'integer', value: 4 });
    expect(record.values[3][1]).toEqual({ type: 'expression', value: null });
  });

  test('should validate PK across nested and top-level records', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar

        records (id, name) {
          1, 'Alice'
        }
      }

      records users(id, name) {
        1, 'Bob'  // Duplicate PK
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toContain('Duplicate PK');
  });

  test('should validate unique across nested and top-level records', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        name varchar

        records (id, email) {
          1, 'alice@example.com'
        }
      }

      records users(id, email, name) {
        2, 'alice@example.com', 'Alice2'  // Duplicate email
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toContain('Duplicate UNIQUE');
  });
});
