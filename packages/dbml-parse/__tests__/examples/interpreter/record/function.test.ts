import { CompileErrorCode } from '@/index';
import { interpret } from '@tests/utils';

describe('[example - function] function blocks', () => {
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

    const result = interpret(source);
    const errors = result.getErrors();

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

    const result = interpret(source);
    const errors = result.getErrors();

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

    const result = interpret(source);
    const errors = result.getErrors();

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

    const result = interpret(source);
    const errors = result.getErrors();

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

    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE);
    expect(errors[0].diagnostic).toBe("'security' must be one of: invoker, definer");
  });
});
