import { CompileError, CompileErrorCode } from '@/core/types';
import type { AttributeNode } from '@/core/types/nodes';
import { extractMetadataValue, invalidMetadataValueError } from '@/core/utils/interpret';

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
      errors.push(invalidMetadataValueError(
        errorCodes.invalidValue,
        `Custom setting '${name}'`,
        attr.value,
        attr.value || attr.name || attr,
      ));
    }
  });

  return errors;
}
