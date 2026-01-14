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

export { extractNumericLiteral } from '@/core/analyzer/utils';

// Check if value is a NULL literal/Empty node
export function isNullish (value: SyntaxNode): boolean {
  if (isExpressionAnIdentifierNode(value)) {
    const varName = value.expression.variable?.value?.toLowerCase();
    return varName === 'null';
  }
  return value instanceof EmptyNode;
}

// Check if value is an empty string literal ('')
export function isEmptyStringLiteral (value: SyntaxNode): boolean {
  return extractQuotedStringToken(value).unwrap_or(undefined) === '';
}

// Check if value is a function expression (backtick)
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
export function tryExtractNumeric (value: SyntaxNode | boolean | number | string): number | null {
  // Handle primitive boolean (true=1, false=0)
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  // Handle primitive number
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  // Handle primitive string
  if (typeof value === 'string') {
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
  }

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
export function tryExtractBoolean (value: SyntaxNode | boolean | number | string): boolean | null {
  // Handle primitive boolean
  if (typeof value === 'boolean') {
    return value;
  }

  // Handle primitive number
  if (typeof value === 'number') {
    if (value === 0) return false;
    if (value === 1) return true;
    return null;
  }

  // Handle primitive string
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
export function tryExtractEnum (value: SyntaxNode | boolean | number | string): string | null {
  // Handle primitives - convert to string
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  // Handle primitive string
  if (typeof value === 'string') {
    return value;
  }

  // Enum field reference: gender.male
  const fragments = destructureComplexVariable(value).unwrap_or(undefined);
  if (fragments) {
    return last(fragments)!;
  }

  // Quoted string: 'male'
  return extractQuotedStringToken(value).unwrap_or(null);
}

// Try to extract a string value from a syntax node or primitive
// Example: "abc", 'abc'
export function tryExtractString (value: SyntaxNode | boolean | number | string): string | null {
  // Handle primitives - convert to string
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  // Handle primitive string
  if (typeof value === 'string') {
    return value;
  }

  // Quoted string: 'hello', "world"
  return extractQuotedStringToken(value).unwrap_or(null);
}

// ISO 8601 date format: YYYY-MM-DD
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ISO 8601 time format: HH:MM:SS with optional fractional seconds and timezone
const ISO_TIME_REGEX = /^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

// ISO 8601 datetime format: YYYY-MM-DDTHH:MM:SS with optional fractional seconds and timezone
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

// Try to extract a datetime value from a syntax node or primitive in ISO format
// Supports: date (YYYY-MM-DD), time (HH:MM:SS), datetime (YYYY-MM-DDTHH:MM:SS)
// Example: '2024-01-15', '10:30:00', '2024-01-15T10:30:00Z'
export function tryExtractDateTime (value: SyntaxNode | boolean | number | string): string | null {
  // Handle primitives - only string can be a valid datetime
  if (typeof value === 'boolean' || typeof value === 'number') {
    return null;
  }

  // Handle primitive string
  const strValue = typeof value === 'string'
    ? value
    : extractQuotedStringToken(value).unwrap_or(null);

  if (strValue === null) return null;

  // Validate ISO format
  if (ISO_DATE_REGEX.test(strValue) || ISO_TIME_REGEX.test(strValue) || ISO_DATETIME_REGEX.test(strValue)) {
    return strValue;
  }

  return null;
}

// Check if a string is a valid ISO date format
export function isIsoDate (value: string): boolean {
  return ISO_DATE_REGEX.test(value);
}

// Check if a string is a valid ISO time format
export function isIsoTime (value: string): boolean {
  return ISO_TIME_REGEX.test(value);
}

// Check if a string is a valid ISO datetime format
export function isIsoDateTime (value: string): boolean {
  return ISO_DATETIME_REGEX.test(value);
}
