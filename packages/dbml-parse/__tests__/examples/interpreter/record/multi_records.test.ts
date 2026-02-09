import { CompileErrorCode } from '@/index';
import { interpret } from '@tests/utils';

describe('[example - record] multiple records blocks', () => {
  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks for the same table', () => {
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

      records users(id, name, email) {
        5, 'Charlie', 'charlie@example.com'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties (3 blocks = 4 errors)
    expect(errors.length).toBe(4);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records blocks for the same Table 'users' - A Table can only have one Records block");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records blocks for the same Table 'users' - A Table can only have one Records block");
    expect(errors[2].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[2].diagnostic).toBe("Duplicate Records blocks for the same Table 'users' - A Table can only have one Records block");
    expect(errors[3].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[3].diagnostic).toBe("Duplicate Records blocks for the same Table 'users' - A Table can only have one Records block");
  });

  test('should report error for nested and top-level records blocks', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        price decimal

        records (id, name) {
          1, 'Laptop'
        }
      }

      records products(id, name, price) {
        2, 'Mouse', 29.99
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records blocks for the same Table 'products' - A Table can only have one Records block");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records blocks for the same Table 'products' - A Table can only have one Records block");
  });

  test('should report error across multiple tables with duplicate blocks', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
      }

      records users(id, name) {
        1, 'Alice'
      }

      records posts(id, title) {
        1, 'First post'
      }

      records users(id, name) {
        2, 'Bob'
      }

      records posts(id, title) {
        2, 'Second post'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // 2 blocks for users + 2 blocks for posts = 4 errors
    expect(errors.length).toBe(4);
    expect(errors.filter((e) => e.diagnostic.includes("'users'")).length).toBe(2);
    expect(errors.filter((e) => e.diagnostic.includes("'posts'")).length).toBe(2);
    expect(errors.every((e) => e.code === CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE)).toBe(true);
  });
});
