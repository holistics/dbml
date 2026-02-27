import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/index';
import { analyze } from '@tests/utils';

describe('[example - function] function validator', () => {
  test('should accept a valid fully-specified function with zero errors', () => {
    const source = `
      Function simple_add {
        schema public
        returns integer
        args [a: integer, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior immutable
        security definer
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(0);
  });

  test('should accept multiple valid functions with zero errors', () => {
    const source = `
      Function increment {
        schema public
        returns integer
        args [len_from: integer, len_to: integer]
        body \`
            DECLARE
                film_count INTEGER;
            BEGIN
                SELECT COUNT(*)
                INTO film_count
                FROM film
                WHERE length BETWEEN len_from AND len_to;
                RETURN film_count;
            END;
        \`
        language plpgsql
        behavior volatile
        security invoker
      }

      Function simple_add {
        schema public
        returns integer
        args [a: integer, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior immutable
        security definer
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(0);
  });

  test('should report error for function without a name', () => {
    const source = `
      Function {
        schema public
        returns integer
        args [a: integer, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior immutable
        security definer
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.NAME_NOT_FOUND)).toBe(true);
  });

  test('should report error for duplicate field', () => {
    const source = `
      Function simple_add {
        schema public
        returns integer
        returns text
        args [a: integer, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior immutable
        security definer
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_FUNCTION_FIELD)).toBe(true);
  });

  test('should report error for unknown field', () => {
    const source = `
      Function simple_add {
        schema public
        returns integer
        args [a: integer, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior immutable
        security definer
        unknown_field foo
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.UNKNOWN_FUNCTION_FIELD)).toBe(true);
  });

  test('should report error for function nested inside a table', () => {
    const source = `
      Table users {
        id integer [pk]

        Function simple_add {
          schema public
          returns integer
          args [a: integer, b: integer]
          body \`
              BEGIN
                RETURN a + b;
              END;
          \`
          language plpgsql
          behavior immutable
          security definer
        }
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.INVALID_FUNCTION_CONTEXT)).toBe(true);
  });

  test('should report error for args with non-list value', () => {
    const source = `
      Function simple_add {
        schema public
        returns integer
        args foo
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior immutable
        security definer
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE)).toBe(true);
    expect(errors.some((e) => e.diagnostic.includes('args'))).toBe(true);
  });

  test('should report error for sub-element inside Function block', () => {
    const source = `
      Function simple_add {
        schema public
        returns integer
        args [a: integer, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior immutable
        security definer

        Note {
          'this is a note'
        }
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.UNKNOWN_FUNCTION_FIELD)).toBe(true);
  });

  test('should report error for unrecognized return type', () => {
    const source = `
      Function simple_add {
        schema public
        returns integerrr
        args [a: integer, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior immutable
        security definer
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE);
    expect(errors[0].diagnostic).toBe("'returns' must be a valid return type (e.g. void, integer, text, ...)");
  });

  test('should report error for invalid arg types', () => {
    const source = `
      Function simple_add {
        schema public
        returns integer
        args [a: void, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior immutable
        security definer
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE);
    expect(errors[0].diagnostic).toBe("Argument type 'void' is not valid");
  });

  test('should report error for unrecognized language', () => {
    const source = `
      Function simple_add {
        schema public
        returns integer
        args [a: integer, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language javascript
        behavior immutable
        security definer
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE);
    expect(errors[0].diagnostic).toBe("'language' must be one of: plpgsql, sql, c, internal");
  });

  test('should report error for unrecognized behavior parameter', () => {
    const source = `
      Function simple_add {
        schema public
        returns integer
        args [a: integer, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior behavior
        security definer
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE);
    expect(errors[0].diagnostic).toBe("'behavior' must be one of: volatile, immutable, stable");
  });

  test('should report error for unrecognized security parameter', () => {
    const source = `
      Function simple_add {
        schema public
        returns integer
        args [a: integer, b: integer]
        body \`
            BEGIN
              RETURN a + b;
            END;
        \`
        language plpgsql
        behavior immutable
        security security
      }
    `;

    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE);
    expect(errors[0].diagnostic).toBe("'security' must be one of: invoker, definer");
  });
});
