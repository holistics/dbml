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

// ISO 8601 datetime/date/time formats
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_REGEX = /^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

// Try to extract a datetime value from a syntax node or primitive in ISO format
// Supports: date (YYYY-MM-DD), time (HH:MM:SS), datetime (YYYY-MM-DDTHH:MM:SS)
// Example: '2024-01-15', '10:30:00', '2024-01-15T10:30:00Z'
export function tryExtractDateTime (value: SyntaxNode | string | undefined | null): string | null {
  // Handle null/undefined
  if (value === null || value === undefined) return null;

  // Handle primitive string
  if (typeof value === 'string') {
    if (ISO_DATETIME_REGEX.test(value) || ISO_DATE_REGEX.test(value) || ISO_TIME_REGEX.test(value)) {
      return value;
    }
    return null;
  }

  const strValue = extractQuotedStringToken(value).unwrap_or(null);

  if (strValue === null) return null;

  if (ISO_DATETIME_REGEX.test(strValue) || ISO_DATE_REGEX.test(strValue) || ISO_TIME_REGEX.test(strValue)) {
    return strValue;
  }

  return null;
}

export function isIsoDateTime (value: string): boolean {
  return ISO_DATETIME_REGEX.test(value);
}
