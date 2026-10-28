import { CompileError, CompileErrorCode, MetadataTargetKind } from '@/core/types';
import type { AttributeNode, ElementDeclarationNode } from '@/core/types/nodes';
import { extractMetadataValue } from '@/core/utils/interpret';

export function getMetadataTargetKind (node: ElementDeclarationNode): MetadataTargetKind | undefined {
  const value = node.targetKind?.value?.toLowerCase();
  return Object.values(MetadataTargetKind).find((key) => key.toLowerCase() === value);
}

export function validateCustomInlineMetadata (
  name: string,
  attributes: AttributeNode[],
  errorCodes: { duplicate: CompileErrorCode; invalidValue: CompileErrorCode },
): CompileError[] {
  const errors: CompileError[] = [];

  if (attributes.length > 1) {
    errors.push(...attributes.map((attribute) => new CompileError(
      errorCodes.duplicate,
      `'${name}' can only appear once`,
      attribute,
    )));
  }

  attributes.forEach((attribute) => {
    if (extractMetadataValue(attribute.value) === undefined) {
      errors.push(new CompileError(
        errorCodes.invalidValue,
        `Custom setting '${name}' must be a string, a color literal, a number literal, or a boolean literal`,
        attribute.value || attribute.name || attribute,
      ));
    }
  });

  return errors;
}
