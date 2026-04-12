import type { SyntaxNode } from '@/core/types/nodes';
import {
  FunctionExpressionNode,
  PrefixExpressionNode,
  EmptyNode,
} from '@/core/types/nodes';
import {
  isExpressionAnIdentifierNode, isExpressionASignedNumberExpression,
} from '@/core/utils/expression';
import {
  destructureComplexVariable, extractQuotedStringToken, extractNumericLiteral,
} from '@/core/utils/expression';
import { last } from 'lodash-es';
import { DateTime } from 'luxon';

export { extractNumericLiteral } from '@/core/utils/expression';

// Check if value is a NULL literal/Empty node
export function isNullish (value: SyntaxNode): boolean {
  if (isExpressionAnIdentifierNode(value)) {
    const varName = value.expression.variable?.value?.toLowerCase();
    return varName === 'null';
  }
  return value instanceof EmptyNode;
}

export function isEmptyStringLiteral (value: SyntaxNode): boolean {
  return extractQuotedStringToken(value) === '';
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
export function tryExtractNumeric (value: SyntaxNode | number | string | boolean | undefined | null): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return !isNaN(parsed) ? parsed : null;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;

  const num = extractSignedNumber(value);
  if (num !== null) return num;

  const strValue = extractQuotedStringToken(value);
  if (strValue !== undefined) {
    const parsed = Number(strValue);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

// Try to extract an integer value from a syntax node or primitive
// Rejects decimal values
export function tryExtractInteger (value: SyntaxNode | number | string | boolean | undefined | null): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return null;
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (isNaN(parsed)) return null;
    if (!Number.isInteger(parsed)) return null;
    return parsed;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;

  const num = extractSignedNumber(value);
  if (num !== null) {
    if (!Number.isInteger(num)) return null;
    return num;
  }

  const strValue = extractQuotedStringToken(value);
  if (strValue !== undefined) {
    const parsed = Number(strValue);
    if (!isNaN(parsed) && Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
}

export const TRUTHY_VALUES = [
  'true',
  'yes',
  'y',
  't',
  '1',
];
export const FALSY_VALUES = [
  'false',
  'no',
  'n',
  'f',
  '0',
];

// Try to extract a boolean value from a syntax node or primitive
export function tryExtractBoolean (value: SyntaxNode | number | string | boolean | undefined | null): boolean | null {
  if (value === null || value === undefined) return null;

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

  // Quoted string: 'true', 'false', 'yes', 'no', etc.
  const strValue = extractQuotedStringToken(value)?.toLowerCase();
  if (strValue) {
    if (TRUTHY_VALUES.includes(strValue)) return true;
    if (FALSY_VALUES.includes(strValue)) return false;
  }

  return null;
}

// Try to extract an enum value from a syntax node or primitive
// Either enum references or string are ok
export function tryExtractEnum (value: SyntaxNode | string | undefined | null): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') return value;

  // Enum field reference: gender.male
  const fragments = destructureComplexVariable(value);
  if (fragments) {
    return last(fragments)!;
  }

  // Quoted string: 'male'
  return extractQuotedStringToken(value) ?? null;
}

// Try to extract a string value from a syntax node or primitive
export function tryExtractString (value: SyntaxNode | string | boolean | number | undefined | null): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();

  // Important: DO NOT move extractNumeric to after extractBoolean, as `1` is extracted as `true`
  const res = extractQuotedStringToken(value) ?? tryExtractNumeric(value) ?? tryExtractBoolean(value);
  return res === null || res === undefined ? null : res.toString();
}

// Supported datetime formats using luxon format tokens
const SUPPORTED_DATE_FORMATS = [
  'yyyy-MM-dd', // ISO date: 2023-12-31
  'M/d/yyyy', // MM/dd/yyyy: 12/31/2023 or 1/5/2023
  'd MMM yyyy', // d MMM yyyy: 31 Dec 2023 or 1 Jan 2023
  'MMM d, yyyy', // MMM d, yyyy: Dec 31, 2023
];

const SUPPORTED_DATETIME_FORMATS = [
  'yyyy-MM-dd HH:mm:ss', // ISO datetime with space: 2023-12-31 23:59:59
  'yyyy-MM-dd HH:mm:ss.SSS', // 2023-12-31 23:59:59.000
  'yyyy-MM-dd HH:mm:ss.SSSZZ', // 2023-12-31 23:59:59.000+07:00
  'yyyy-MM-dd HH:mm:ssZZ', // 2023-12-31 23:59:59+07:00
];

const SUPPORTED_TIME_FORMATS = [
  'HH:mm:ss', // Time: 23:59:59
  'HH:mm:ssZZ', // Time with timezone
  'HH:mm:ss.SSS', // Time with milliseconds: 23:59:59.999
  'HH:mm:ss.SSSZZ', // Time with milliseconds & timezone
];

// Try to extract a datetime value from a syntax node or primitive & normalized to ISO 8601
export function tryExtractDateTime (value: SyntaxNode | string | undefined | null): string | null {
  if (value === null || value === undefined) return null;

  const extractedValue = typeof value === 'string' ? value : extractQuotedStringToken(value);

  if (extractedValue === null || extractedValue === undefined) return null;

  // We prioritize more specific formats, like time-only & date-only before ISO-8601
  for (const format of SUPPORTED_TIME_FORMATS) {
    const dt = DateTime.fromFormat(extractedValue, format, { setZone: true });
    if (dt.isValid) {
      return dt.toISOTime({
        suppressMilliseconds: true,
        includeOffset: hasExplicitTimeZone(dt),
      });
    }
  }

  for (const format of SUPPORTED_DATE_FORMATS) {
    const dt = DateTime.fromFormat(extractedValue, format, { setZone: true });
    if (dt.isValid) {
      return dt.toISODate();
    }
  }

  for (const format of SUPPORTED_DATETIME_FORMATS) {
    const dt = DateTime.fromFormat(extractedValue, format, { setZone: true });
    if (dt.isValid) {
      return dt.toISO({
        suppressMilliseconds: true,
        includeOffset: hasExplicitTimeZone(dt),
      });
    }
  }

  const isoDate = DateTime.fromISO(extractedValue, { setZone: true });
  if (isoDate.isValid) {
    return isoDate.toISO({
      suppressMilliseconds: true,
      includeOffset: hasExplicitTimeZone(isoDate),
    });
  }

  return null;

  function hasExplicitTimeZone (dt: DateTime): boolean {
    return dt.zone.type !== 'system';
  }
}
