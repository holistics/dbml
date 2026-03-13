import {
  isBooleanType,
  isNumericType,
  isDateTimeType,
  tryExtractBoolean,
  tryExtractNumeric,
  tryExtractString,
  tryExtractDateTime,
} from '@/core/interpreter/records/utils';
import { isAlphaOrUnderscore, isDigit } from '@/utils/chars';

// True if name can be used unquoted in DBML
export function isValidIdentifier (name: string): boolean {
  if (!name) return false;
  return name.split('').every((char) => isAlphaOrUnderscore(char) || isDigit(char)) && !isDigit(name[0]);
}

// Wraps identifier in double quotes if it contains special characters
export function addDoubleQuoteIfNeeded (identifier: string): string {
  if (isValidIdentifier(identifier)) {
    return identifier;
  }
  return `"${escapeString(identifier)}"`;
}

// Processes escape sequences in a raw string
export function unescapeString (str: string): string {
  let result = '';
  let i = 0;

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

// Adds backslashes before special characters in a string
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

// Formats a typed record value as a DBML literal string
export function formatRecordValue (recordValue: { value: any; type: string } | string | number | boolean | null | undefined): string {
  // Handle undefined and null primitives
  if (recordValue === undefined || recordValue === null) {
    return 'null';
  }

  // Handle primitive types directly
  if (typeof recordValue === 'boolean') {
    return recordValue ? 'true' : 'false';
  }

  if (typeof recordValue === 'number') {
    return String(recordValue);
  }

  if (typeof recordValue === 'string') {
    return `'${escapeString(recordValue)}'`;
  }

  // Handle object format { value, type }
  const { value, type } = recordValue;

  // Handle null/undefined values
  if (value === null || value === undefined || (isBooleanType(type) && typeof value === 'string' && value.toLowerCase() === 'null')) {
    return 'null';
  }

  // Handle expressions (backtick strings)
  if (type === 'expression') {
    return typeof value === 'string' && value.toLowerCase().trim() === 'null' ? 'null' : `\`${value}\``;
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
      return `'${escapeString(extracted)}'`;
    }
    // If extraction failed, wrap in function expression
    return `\`${value}\``;
  }

  // Default: string types and others
  const extracted = tryExtractString(value);
  if (extracted !== null) {
    return `'${escapeString(extracted)}'`;
  }

  // If all extractions failed, wrap in function expression
  return `\`${value}\``;
}

// Splits a dot-delimited identifier into its components, respecting quoted segments
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
