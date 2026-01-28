import { CompileErrorCode } from '@/index';
import { interpret } from '@tests/utils';

describe('[example - record] multiple records blocks', () => {
  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks for the same table with different columns', () => {
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

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks, one with explicit columns and one without', () => {
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

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'posts'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'posts'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks for the same table', () => {
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
        2, 'Mouse'
      }

      records products(id, name, price) {
        3, 'Keyboard', 299.99
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties (3 blocks = 4 errors)
    expect(errors.length).toBe(4);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'products'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'products'");
    expect(errors[2].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[2].diagnostic).toBe("Duplicate Records for the same Table 'products'");
    expect(errors[3].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[3].diagnostic).toBe("Duplicate Records for the same Table 'products'");
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

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for mixing nested and top-level records for same table', () => {
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
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple nested records blocks with same columns', () => {
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
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'products'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'products'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for nested records blocks with different columns', () => {
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
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'products'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'products'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for complex mix of nested, top-level, with and without columns', () => {
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
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties (4 blocks = 6 errors)
    expect(errors.length).toBe(6);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'orders'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'orders'");
    expect(errors[2].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[2].diagnostic).toBe("Duplicate Records for the same Table 'orders'");
    expect(errors[3].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[3].diagnostic).toBe("Duplicate Records for the same Table 'orders'");
    expect(errors[4].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[4].diagnostic).toBe("Duplicate Records for the same Table 'orders'");
    expect(errors[5].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[5].diagnostic).toBe("Duplicate Records for the same Table 'orders'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for nested and top-level records for same table', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar

        records (id, name) {
          1, 'Alice'
        }
      }

      records users(id, name) {
        1, 'Bob'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for nested and top-level records for same table with unique column', () => {
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
        2, 'alice@example.com', 'Alice2'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });
});
