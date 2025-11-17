/**
 * Test Helpers for Property-Based Tests
 *
 * Shared utilities for property-based testing across different parsers.
 */

/**
 * Deep comparison excluding token properties and empty values
 * (borrowed from example-based tests)
 */
export function isEqualExcludeTokenEmpty (received: any, expected: any): void {
  const normalize = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return undefined;
    }

    if (Array.isArray(obj)) {
      const filtered = obj.map(normalize).filter((item) => item !== undefined);
      return filtered.length > 0 ? filtered : undefined;
    }

    if (typeof obj === 'object') {
      const result: any = {};
      for (const key in obj) {
        // Skip token properties
        if (key === 'token' || key === 'tokens') {
          continue;
        }
        const value = normalize(obj[key]);
        if (value !== undefined) {
          result[key] = value;
        }
      }
      return Object.keys(result).length > 0 ? result : undefined;
    }

    return obj;
  };

  const normalizedReceived = normalize(received);
  const normalizedExpected = normalize(expected);

  expect(normalizedReceived).toEqual(normalizedExpected);
}

/**
 * Validate JSON schema structure
 */
export interface JsonSchema {
  schemas?: any[];
  tables?: any[];
  refs?: any[];
  enums?: any[];
  tableGroups?: any[];
  project?: any;
  records?: any[];
}

export function hasValidSchemaStructure (obj: any): obj is JsonSchema {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  // Must have at least one of the expected top-level properties
  const hasExpectedProps =
    'tables' in obj
    || 'enums' in obj
    || 'refs' in obj
    || 'schemas' in obj
    || 'project' in obj;

  if (!hasExpectedProps) {
    return false;
  }

  // If present, arrays must be actual arrays
  if (obj.tables && !Array.isArray(obj.tables)) return false;
  if (obj.refs && !Array.isArray(obj.refs)) return false;
  if (obj.enums && !Array.isArray(obj.enums)) return false;
  if (obj.schemas && !Array.isArray(obj.schemas)) return false;
  if (obj.tableGroups && !Array.isArray(obj.tableGroups)) return false;
  if (obj.records && !Array.isArray(obj.records)) return false;

  return true;
}

/**
 * Validate table structure
 */
export function hasValidTableStructure (table: any): boolean {
  if (typeof table !== 'object' || table === null) {
    return false;
  }

  // Must have name and fields
  if (typeof table.name !== 'string') return false;
  if (!Array.isArray(table.fields)) return false;

  // Fields must have name and type
  for (const field of table.fields) {
    if (typeof field.name !== 'string') return false;
    if (!field.type || typeof field.type.type_name !== 'string') return false;
  }

  return true;
}

/**
 * Validate enum structure
 */
export function hasValidEnumStructure (enumDef: any): boolean {
  if (typeof enumDef !== 'object' || enumDef === null) {
    return false;
  }

  if (typeof enumDef.name !== 'string') return false;
  if (!Array.isArray(enumDef.values)) return false;

  for (const value of enumDef.values) {
    if (typeof value.name !== 'string') return false;
  }

  return true;
}

/**
 * Validate ref structure
 */
export function hasValidRefStructure (ref: any): boolean {
  if (typeof ref !== 'object' || ref === null) {
    return false;
  }

  if (!Array.isArray(ref.endpoints) || ref.endpoints.length !== 2) {
    return false;
  }

  for (const endpoint of ref.endpoints) {
    if (typeof endpoint.tableName !== 'string') return false;
    if (!Array.isArray(endpoint.fieldNames)) return false;
    if (endpoint.relation !== '1' && endpoint.relation !== '*') return false;
  }

  return true;
}

/**
 * Check if two JSON schemas are structurally equivalent
 * (ignoring order and token properties)
 */
export function areSchemasEquivalent (schema1: any, schema2: any): boolean {
  const normalize = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return undefined;
    }

    if (Array.isArray(obj)) {
      // Sort arrays by JSON representation for order-independent comparison
      return obj
        .map(normalize)
        .filter((item) => item !== undefined)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }

    if (typeof obj === 'object') {
      const result: any = {};
      const keys = Object.keys(obj).sort();
      for (const key of keys) {
        // Skip token properties
        if (key === 'token' || key === 'tokens') {
          continue;
        }
        const value = normalize(obj[key]);
        if (value !== undefined) {
          result[key] = value;
        }
      }
      return Object.keys(result).length > 0 ? result : undefined;
    }

    return obj;
  };

  const normalized1 = normalize(schema1);
  const normalized2 = normalize(schema2);

  return JSON.stringify(normalized1) === JSON.stringify(normalized2);
}

/**
 * Extract table names from schema
 */
export function getTableNames (schema: JsonSchema): string[] {
  if (!schema.tables) return [];
  return schema.tables.map((t) => t.name).filter((name) => typeof name === 'string');
}

/**
 * Extract enum names from schema
 */
export function getEnumNames (schema: JsonSchema): string[] {
  if (!schema.enums) return [];
  return schema.enums.map((e) => e.name).filter((name) => typeof name === 'string');
}

/**
 * Count total fields across all tables
 */
export function countTotalFields (schema: JsonSchema): number {
  if (!schema.tables) return 0;
  return schema.tables.reduce((sum, table) => {
    return sum + (Array.isArray(table.fields) ? table.fields.length : 0);
  }, 0);
}

/**
 * Count total relationships
 */
export function countTotalRefs (schema: JsonSchema): number {
  return schema.refs?.length ?? 0;
}

/**
 * Validate that parser doesn't crash (just catches exceptions)
 */
export function parseWithoutCrashing (
  parseFunc: (input: string) => any,
  input: string,
): { success: boolean; error?: Error } {
  try {
    parseFunc(input);
    return { success: true };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

/**
 * Check if error message is informative
 */
export function hasInformativeError (error: Error): boolean {
  const message = error.message || '';

  // Error should mention what went wrong
  const hasContext =
    message.length > 10
    && (message.includes('line')
      || message.includes('column')
      || message.includes('token')
      || message.includes('expected')
      || message.includes('syntax')
      || message.includes('parse')
      || message.includes('invalid'));

  return hasContext;
}

/**
 * Test round-trip idempotency: parse -> export -> parse -> export -> parse
 * Verifies that 2nd and 3rd parse results are identical
 */
export function testRoundTripIdempotency (
  parseFunc: (input: string) => any,
  exportFunc: (schema: any) => string,
  initialInput: string,
): { idempotent: boolean; schema1?: any; schema2?: any; schema3?: any; error?: string } {
  try {
    // First parse
    const schema1 = parseFunc(initialInput);

    // First export
    const exported1 = exportFunc(schema1);

    // Second parse
    const schema2 = parseFunc(exported1);

    // Second export
    const exported2 = exportFunc(schema2);

    // Third parse
    const schema3 = parseFunc(exported2);

    // Check if schema2 and schema3 are equivalent
    const idempotent = areSchemasEquivalent(schema2, schema3);

    return {
      idempotent,
      schema1,
      schema2,
      schema3,
    };
  } catch (error) {
    return {
      idempotent: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Create a spy for error detection
 */
export function createErrorCollector (): {
  errors: Array<{ message: string; location?: any }>;
  collector: (message: string, location?: any) => void;
} {
  const errors: Array<{ message: string; location?: any }> = [];

  const collector = (message: string, location?: any) => {
    errors.push({ message, location });
  };

  return { errors, collector };
}

/**
 * Measure parser performance
 */
export function measureParseTime (
  parseFunc: (input: string) => any,
  input: string,
): { result: any; timeMs: number } {
  const start = Date.now();
  const result = parseFunc(input);
  const timeMs = Date.now() - start;

  return { result, timeMs };
}

/**
 * Check if parsing is reasonably fast (< 1 second for typical inputs)
 */
export function isParsingReasonablyFast (timeMs: number, inputLength: number): boolean {
  // Allow more time for longer inputs
  const maxTimeMs = Math.min(1000, 100 + inputLength / 10);
  return timeMs < maxTimeMs;
}
