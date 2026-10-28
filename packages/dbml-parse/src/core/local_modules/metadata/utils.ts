import { CompileError, CompileErrorCode } from '@/core/types';
import type { AttributeNode } from '@/core/types/nodes';
import { extractMetadataValue } from '@/core/utils/interpret';

export function validateCustomInlineMetadata (
  name: string,
  attrs: AttributeNode[],
  errorCodes: { duplicate: CompileErrorCode; invalidValue: CompileErrorCode },
): CompileError[] {
  const errors: CompileError[] = [];

  if (attrs.length > 1) {
    errors.push(...attrs.map((attr) => new CompileError(
      errorCodes.duplicate,
      `'${name}' can only appear once`,
      attr,
    )));
  }

  attrs.forEach((attr) => {
    if (extractMetadataValue(attr.value) === undefined) {
      errors.push(new CompileError(
        errorCodes.invalidValue,
        `Custom setting '${name}' must be a string, a color literal, a number literal, or a boolean literal`,
        attr.value || attr.name || attr,
      ));
    }
  });

  return errors;
}
