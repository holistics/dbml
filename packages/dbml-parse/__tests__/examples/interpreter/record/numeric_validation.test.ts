import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

describe('[example - record] Numeric type validation', () => {
  describe('Integer validation', () => {
    test('should accept valid integer values', () => {
      const source = `
        Table products {
          id int
          quantity bigint
          serial_num smallint
        }

        records products(id, quantity, serial_num) {
          1, 1000, 5
          2, -500, -10
          3, 0, 0
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should reject decimal value for integer column', () => {
      const source = `
        Table products {
          id int
          quantity int
        }

        records products(id, quantity) {
          1, 10.5
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[0].diagnostic).toBe("Invalid integer value 10.5 for column 'quantity': expected integer, got decimal");
    });

    test('should reject multiple decimal values for integer columns', () => {
      const source = `
        Table products {
          id int
          quantity int
          stock int
        }

        records products(id, quantity, stock) {
          1, 10.5, 20
          2, 15, 30.7
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(2);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[0].diagnostic).toBe("Invalid integer value 10.5 for column 'quantity': expected integer, got decimal");
      expect(errors[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[1].diagnostic).toBe("Invalid integer value 30.7 for column 'stock': expected integer, got decimal");
    });

    test('should accept negative integers', () => {
      const source = `
        Table transactions {
          id int
          amount int
        }

        records transactions(id, amount) {
          1, -100
          2, -500
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });
  });

  describe('Decimal/numeric precision and scale validation', () => {
    test('should accept valid decimal values within precision and scale', () => {
      const source = `
        Table products {
          id int
          price decimal(10, 2)
          rate numeric(5, 3)
        }

        records products(id, price, rate) {
          1, 99.99, 1.234
          2, 12345678.90, 12.345
          3, -999.99, -0.001
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should reject decimal value exceeding precision', () => {
      const source = `
        Table products {
          id int
          price decimal(5, 2)
        }

        records products(id, price) {
          1, 12345.67
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[0].diagnostic).toBe("Numeric value 12345.67 for column 'price' exceeds precision: expected at most 5 total digits, got 7");
    });

    test('should reject decimal value exceeding scale', () => {
      const source = `
        Table products {
          id int
          price decimal(10, 2)
        }

        records products(id, price) {
          1, 99.999
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[0].diagnostic).toBe("Numeric value 99.999 for column 'price' exceeds scale: expected at most 2 decimal digits, got 3");
    });

    test('should accept decimal value with fewer decimal places than scale', () => {
      const source = `
        Table products {
          id int
          price decimal(10, 2)
        }

        records products(id, price) {
          1, 99.9
          2, 100
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should handle negative decimal values correctly', () => {
      const source = `
        Table transactions {
          id int
          amount decimal(8, 2)
        }

        records transactions(id, amount) {
          1, -12345.67
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should reject negative decimal value exceeding precision', () => {
      const source = `
        Table transactions {
          id int
          amount decimal(5, 2)
        }

        records transactions(id, amount) {
          1, -12345.67
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[0].diagnostic).toBe("Numeric value -12345.67 for column 'amount' exceeds precision: expected at most 5 total digits, got 7");
    });

    test('should validate multiple decimal columns', () => {
      const source = `
        Table products {
          id int
          price decimal(5, 2)
          tax_rate decimal(5, 2)
        }

        records products(id, price, tax_rate) {
          1, 12345.67, 0.99
          2, 99.99, 10.123
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(2);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[0].diagnostic).toBe("Numeric value 12345.67 for column 'price' exceeds precision: expected at most 5 total digits, got 7");
      expect(errors[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[1].diagnostic).toBe("Numeric value 10.123 for column 'tax_rate' exceeds scale: expected at most 2 decimal digits, got 3");
    });

    test('should allow decimal/numeric types without precision parameters', () => {
      const source = `
        Table products {
          id int
          price decimal
          rate numeric
        }

        records products(id, price, rate) {
          1, 999999999.999999, 123456.789012
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });
  });

  describe('Float/double validation', () => {
    test('should accept valid float values', () => {
      const source = `
        Table measurements {
          id int
          temperature float
          pressure double
        }

        records measurements(id, temperature, pressure) {
          1, 98.6, 101325.5
          2, -40.0, 0.001
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should accept integers for float columns', () => {
      const source = `
        Table measurements {
          id int
          value float
        }

        records measurements(id, value) {
          1, 100
          2, -50
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });
  });

  describe('Scientific notation validation', () => {
    test('should accept scientific notation that evaluates to integer', () => {
      const source = `
        Table data {
          id int
          count int
        }

        records data(id, count) {
          1, 1e2
          2, 2E3
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should reject scientific notation that evaluates to decimal for integer column', () => {
      const source = `
        Table data {
          id int
          count int
        }

        records data(id, count) {
          1, 2e-1
          2, 3.5e-1
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(2);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[0].diagnostic).toBe("Invalid integer value 0.2 for column 'count': expected integer, got decimal");
      expect(errors[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[1].diagnostic).toBe("Invalid integer value 0.35 for column 'count': expected integer, got decimal");
    });

    test('should accept scientific notation for decimal/numeric types', () => {
      const source = `
        Table data {
          id int
          value decimal(10, 2)
        }

        records data(id, value) {
          1, 1.5e2
          2, 3.14e1
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should validate precision/scale for scientific notation', () => {
      const source = `
        Table data {
          id int
          value decimal(5, 2)
        }

        records data(id, value) {
          1, 1e6
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[0].diagnostic).toBe("Numeric value 1000000 for column 'value' exceeds precision: expected at most 5 total digits, got 7");
    });

    test('should accept scientific notation for float types', () => {
      const source = `
        Table measurements {
          id int
          temperature float
          distance double
        }

        records measurements(id, temperature, distance) {
          1, 3.14e2, 1.5e10
          2, -2.5e-3, 6.67e-11
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });
  });

  describe('Mixed numeric type validation', () => {
    test('should validate multiple numeric types in one table', () => {
      const source = `
        Table products {
          id int
          quantity int
          price decimal(10, 2)
          weight float
        }

        records products(id, quantity, price, weight) {
          1, 10, 99.99, 1.5
          2, 20.5, 199.99, 2.75
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(errors[0].diagnostic).toBe("Invalid integer value 20.5 for column 'quantity': expected integer, got decimal");
    });
  });
});
