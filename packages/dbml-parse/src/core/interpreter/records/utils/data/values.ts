import {
  EmptyNode,
  FunctionExpressionNode,
  PrefixExpressionNode,
  SyntaxNode,
} from '@/core/parser/nodes';
import { isExpressionAnIdentifierNode } from '@/core/parser/utils';
import { isExpressionASignedNumberExpression } from '@/core/analyzer/validator/utils';
import { destructureComplexVariable, extractQuotedStringToken, extractNumericLiteral } from '@/core/analyzer/utils';
import { last } from 'lodash-es';
import { DateTime } from 'luxon';

export { extractNumericLiteral } from '@/core/analyzer/utils';

// Check if value is a NULL literal/Empty node
export function isNullish (value: SyntaxNode): boolean {
  if (isExpressionAnIdentifierNode(value)) {
    const varName = value.expression.variable?.value?.toLowerCase();
    return varName === 'null';
  }
  return value instanceof EmptyNode;
}

export function isEmptyStringLiteral (value: SyntaxNode): boolean {
  return extractQuotedStringToken(value).unwrap_or(undefined) === '';
}

export function isFunctionExpression (value: SyntaxNode): value is FunctionExpressionNode {
  return value instanceof FunctionExpressionNode;
}

// Extract a signed number from a node (e.g., -42, +3.14)
// Handles prefix operators on numeric literals
export function extractSignedNumber (node: SyntaxNode): number | null {
  // Try plain numeric literal first
  const literal = extractNumericLiteral(node);
  if (literal !== null) return literal;

  // Try signed number: -42, +3.14
  if (isExpressionASignedNumberExpression(node)) {
    if (node instanceof PrefixExpressionNode && node.expression) {
      const op = node.op?.value;
      const inner = extractNumericLiteral(node.expression);
      if (inner !== null) {
        return op === '-' ? -inner : inner;
      }
    }
  }

  return null;
}

// Try to extract a numeric value from a syntax node or primitive
// Example: 0, 1, '0', '1', "2", -2, "-2"
export function tryExtractNumeric (value: SyntaxNode | number | string | boolean | undefined | null): number | null {
  // Handle null/undefined
  if (value === null || value === undefined) return null;

  // Handle primitive types
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return !isNaN(parsed) ? parsed : null;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;

  // Numeric literal or signed number
  const num = extractSignedNumber(value);
  if (num !== null) return num;

  // Quoted string containing number: "42", '3.14'
  const strValue = extractQuotedStringToken(value).unwrap_or(undefined);
  if (strValue !== undefined) {
    const parsed = Number(strValue);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

export const TRUTHY_VALUES = ['true', 'yes', 'y', 't', '1'];
export const FALSY_VALUES = ['false', 'no', 'n', 'f', '0'];

// Try to extract a boolean value from a syntax node or primitive
// Example: 't', 'f', 'y', 'n', 'true', 'false', true, false, 'yes', 'no', 1, 0, '1', '0'
export function tryExtractBoolean (value: SyntaxNode | number | string | boolean | undefined | null): boolean | null {
  // Handle null/undefined
  if (value === null || value === undefined) return null;

  // Handle primitive types
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 0) return false;
    if (value === 1) return true;
    return null;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (TRUTHY_VALUES.includes(lower)) return true;
    if (FALSY_VALUES.includes(lower)) return false;
    return null;
  }

  // Identifier: true, false
  if (isExpressionAnIdentifierNode(value)) {
    const varName = value.expression.variable?.value?.toLowerCase();
    if (varName === 'true') return true;
    if (varName === 'false') return false;
  }

  // Numeric literal: 0, 1
  const numVal = extractNumericLiteral(value);
  if (numVal === 0) return false;
  if (numVal === 1) return true;

  // Quoted string: 'true', 'false', 'yes', 'no', 'y', 'n', 't', 'f', '0', '1'
  const strValue = extractQuotedStringToken(value)?.unwrap_or('').toLowerCase();
  if (strValue) {
    if (TRUTHY_VALUES.includes(strValue)) return true;
    if (FALSY_VALUES.includes(strValue)) return false;
  }

  return null;
}

// Try to extract an enum value from a syntax node or primitive
// Either enum references or string are ok
export function tryExtractEnum (value: SyntaxNode | string | undefined | null): string | null {
  // Handle null/undefined
  if (value === null || value === undefined) return null;

  // Handle primitive string
  if (typeof value === 'string') return value;

  // Enum field reference: gender.male
  const fragments = destructureComplexVariable(value).unwrap_or(undefined);
  if (fragments) {
    return last(fragments)!;
  }

  // Quoted string: 'male'
  return extractQuotedStringToken(value).unwrap_or(null);
}

// Extract enum access with full path
// Returns { path: ['schema', 'enum'], value: 'field' } for schema.enum.field
// Returns { path: ['enum'], value: 'field' } for enum.field
// Returns { path: [], value: 'field' } for "field" (string literal)
export function extractEnumAccess (value: SyntaxNode): { path: string[]; value: string } | null {
  // Enum field reference: schema.gender.male or gender.male
  const fragments = destructureComplexVariable(value).unwrap_or(undefined);
  if (fragments && fragments.length >= 2) {
    const enumValue = last(fragments)!;
    const enumPath = fragments.slice(0, -1);
    return { path: enumPath, value: enumValue };
  }

  // Quoted string: 'male'
  const stringValue = extractQuotedStringToken(value).unwrap_or(null);
  if (stringValue !== null) {
    return { path: [], value: stringValue };
  }

  return null;
}

// Try to extract a string value from a syntax node or primitive
// Example: "abc", 'abc'
export function tryExtractString (value: SyntaxNode | string | undefined | null): string | null {
  // Handle null/undefined
  if (value === null || value === undefined) return null;

  // Handle primitive string
  if (typeof value === 'string') return value;

  // Quoted string: 'hello', "world"
  return extractQuotedStringToken(value).unwrap_or(null);
}

// Supported datetime formats using luxon format tokens (excluding ISO 8601 which is handled separately)
const SUPPORTED_DATETIME_FORMATS = [
  'yyyy-MM-dd', // ISO date: 2023-12-31
  'HH:mm:ss', // Time: 23:59:59
  'HH:mm:ss.SSS', // Time with milliseconds: 23:59:59.999
  'yyyy-MM-dd HH:mm:ss', // ISO datetime with space: 2023-12-31 23:59:59
  'M/d/yyyy', // MM/dd/yyyy: 12/31/2023 or 1/5/2023
  'd MMM yyyy', // d MMM yyyy: 31 Dec 2023 or 1 Jan 2023
  'MMM d, yyyy', // MMM d, yyyy: Dec 31, 2023
];

function isDateTimeFormat (str: string): boolean {
  // Try ISO 8601 format first (handles dates, times, datetimes with/without timezones)
  const isoDate = DateTime.fromISO(str);
  if (isoDate.isValid) {
    return true;
  }

  // Try other formats
  for (const format of SUPPORTED_DATETIME_FORMATS) {
    const dt = DateTime.fromFormat(str, format);
    if (dt.isValid) {
      return true;
    }
  }

  return false;
}

// Try to extract a datetime value from a syntax node or primitive
// Supports:
//   - ISO 8601: date (YYYY-MM-DD), time (HH:MM:SS), datetime (YYYY-MM-DDTHH:MM:SS)
//   - MM/dd/yyyy: 12/31/2023
//   - d MMM yyyy: 31 Dec 2023
//   - MMM d, yyyy: Dec 31, 2023
//   - yyyy-MM-dd HH:mm:ss: 2023-12-31 23:59:59
// Example: '2024-01-15', '10:30:00', '2024-01-15T10:30:00Z', '12/31/2023', '31 Dec 2023'
export function tryExtractDateTime (value: SyntaxNode | string | undefined | null): string | null {
  // Handle null/undefined
  if (value === null || value === undefined) return null;

  // Handle primitive string
  if (typeof value === 'string') {
    if (isDateTimeFormat(value)) {
      return value;
    }
    return null;
  }

  const strValue = extractQuotedStringToken(value).unwrap_or(null);

  if (strValue === null) return null;

  if (isDateTimeFormat(strValue)) {
    return strValue;
  }

  return null;
}
