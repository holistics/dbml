import {
  isBooleanType,
  isNumericType,
  isDateTimeType,
  tryExtractBoolean,
  tryExtractNumeric,
  tryExtractString,
  tryExtractDateTime,
} from '@/core/interpreter/records/utils';
import { isAlphaOrUnderscore, isDigit } from '@/core/utils';

/**
 * Checks if an identifier is valid (can be used without quotes in DBML).
 * Valid identifiers must:
 * - Contain only alphanumeric characters and underscores
 * - Not start with a digit
 *
 * @param name - The identifier to check
 * @returns True if the identifier is valid and doesn't need quotes
 *
 * @example
 * isValidIdentifier('users') => true
 * isValidIdentifier('user_name') => true
 * isValidIdentifier('user name') => false (contains space)
 * isValidIdentifier('123users') => false (starts with digit)
 */
export function isValidIdentifier (name: string): boolean {
  if (!name) return false;
  return name.split('').every((char) => isAlphaOrUnderscore(char) || isDigit(char)) && !isDigit(name[0]);
}

/**
 * Adds double quotes around an identifier if needed.
 * Identifiers need quotes if they:
 * - Contain non-alphanumeric characters (except underscore)
 * - Start with a digit
 * - Are empty strings
 *
 * @param identifier - The identifier to potentially quote
 * @returns The identifier with double quotes if needed, otherwise unchanged
 *
 * @example
 * addDoubleQuoteIfNeeded('users') => 'users'
 * addDoubleQuoteIfNeeded('user name') => '"user name"'
 * addDoubleQuoteIfNeeded('123users') => '"123users"'
 * addDoubleQuoteIfNeeded('user-name') => '"user-name"'
 */
export function addDoubleQuoteIfNeeded (identifier: string): string {
  if (isValidIdentifier(identifier)) {
    return identifier;
  }
  return `"${identifier}"`;
}

/**
 * Unescapes a string by processing escape sequences.
 * Handles escaped quotes (\"), common escape sequences, unicode (\uHHHH), and arbitrary escapes.
 *
 * @param str - The string to unescape
 * @returns The unescaped string
 *
 * @example
 * unescapeString('table\\"name') => 'table"name'
 * unescapeString('line1\\nline2') => 'line1\nline2'
 * unescapeString('\\u0041BC') => 'ABC'
 * unescapeString('\\x') => 'x'
 */
export function unescapeString (str: string): string {
  let result = '';
  let i = 0;

  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const nextChar = str[i + 1];

      // Handle unicode escape sequences \uHHHH
      if (nextChar === 'u' && i + 5 < str.length) {
        const hex = str.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
      }

      // Handle common escape sequences
      const escapeMap: Record<string, string> = {
        'n': '\n',
        't': '\t',
        'r': '\r',
        'b': '\b',
        'f': '\f',
        'v': '\v',
        '0': '\0',
        '\\': '\\',
        '"': '"',
        '\'': '\'',
        '`': '`',
      };

      if (nextChar in escapeMap) {
        result += escapeMap[nextChar];
        i += 2;
      } else {
        // Unknown escape sequence - just use the character after backslash
        result += nextChar;
        i += 2;
      }
    } else {
      result += str[i];
      i++;
    }
  }

  return result;
}

/**
 * Escapes a string by adding backslashes before special characters.
 * Handles quotes and other characters that need escaping.
 *
 * @param str - The string to escape
 * @returns The escaped string
 *
 * @example
 * escapeString('table"name') => 'table\\"name'
 * escapeString('line1\nline2') => 'line1\\nline2'
 */
export function escapeString (str: string): string {
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    switch (char) {
      case '\\':
        result += '\\\\';
        break;
      case '"':
        result += '\\"';
        break;
      case '\'':
        result += "\\'";
        break;
      case '\n':
        result += '\\n';
        break;
      case '\t':
        result += '\\t';
        break;
      case '\r':
        result += '\\r';
        break;
      case '\b':
        result += '\\b';
        break;
      case '\f':
        result += '\\f';
        break;
      case '\v':
        result += '\\v';
        break;
      case '\0':
        result += '\\0';
        break;
      default:
        result += char;
    }
  }

  return result;
}

/**
 * Formats a record value for DBML output.
 * Handles different data types and converts them to appropriate DBML syntax.
 *
 * @param recordValue - The record value with type information
 * @returns The formatted string representation for DBML
 *
 * @example
 * formatRecordValue({ value: 1, type: 'integer' }) => '1'
 * formatRecordValue({ value: 'Alice', type: 'string' }) => "'Alice'"
 * formatRecordValue({ value: true, type: 'bool' }) => 'true'
 * formatRecordValue({ value: null, type: 'string' }) => 'null'
 */
export function formatRecordValue (recordValue: { value: any; type: string }): string {
  const { value, type } = recordValue;

  // Handle null/undefined values
  if (value === null || value === undefined) {
    return 'null';
  }

  // Handle expressions (backtick strings)
  if (type === 'expression') {
    return `\`${value}\``;
  }

  // Try to extract typed values using tryExtract functions
  // If extraction fails, fall back to function expression

  if (isBooleanType(type)) {
    const extracted = tryExtractBoolean(value);
    if (extracted !== null) {
      return extracted ? 'true' : 'false';
    }
    // If extraction failed, wrap in function expression
    return `\`${value}\``;
  }

  if (isNumericType(type)) {
    const extracted = tryExtractNumeric(value);
    if (extracted !== null) {
      return String(extracted);
    }
    // If extraction failed, wrap in function expression
    return `\`${value}\``;
  }

  if (isDateTimeType(type)) {
    const extracted = tryExtractDateTime(value);
    if (extracted !== null) {
      const quote = extracted.includes('\n') ? '\'\'\'' : '\'';
      return `${quote}${extracted.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}${quote}`;
    }
    // If extraction failed, wrap in function expression
    return `\`${value}\``;
  }

  // Default: string types and others
  const extracted = tryExtractString(value);
  if (extracted !== null) {
    const quote = extracted.includes('\n') ? '\'\'\'' : '\'';
    return `${quote}${extracted.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}${quote}`;
  }

  // If all extractions failed, wrap in function expression
  return `\`${value}\``;
}

/**
 * Splits a qualified identifier string into its components, handling quoted segments.
 *
 * Examples:
 *   - "schema.table" => ["schema", "table"]
 *   - '"schema name".table' => ["schema name", "table"]
 *   - '"schema.with.dots"."table.with.dots".column' => ["schema.with.dots", "table.with.dots", "column"]
 *   - 'schema."table name"."column name"' => ["schema", "table name", "column name"]
 *   - 'schema . table' => ["schema", "table"]
 *
 * @param identifier - The qualified identifier string to split
 * @returns Array of unquoted identifier components
 */
export function splitQualifiedIdentifier (identifier: string): string[] {
  // Match quoted strings (with escaped quotes) or unquoted identifiers
  const pattern = /"(?:[^"\\]|\\.)*"|[^."]+/g;
  const matches = identifier.match(pattern) || [];

  return matches
    .map((match) => {
      // If quoted, remove quotes and unescape
      if (match.startsWith('"') && match.endsWith('"')) {
        const content = match.slice(1, -1);
        return unescapeString(content);
      }
      // Otherwise trim whitespace from unquoted component
      return match.trim();
    })
    .filter((component) => component.length > 0);
}
