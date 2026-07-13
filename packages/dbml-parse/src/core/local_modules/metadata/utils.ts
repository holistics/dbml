import { CompileError, CompileErrorCode, MetadataTargetKind } from '@/core/types';
import type { AttributeNode, ElementDeclarationNode } from '@/core/types/nodes';
import { isValidMetadataValue } from '@/core/utils/validate';

// Resolve a metadata block's target-kind token to a known MetadataTargetKind, or undefined.
export function getMetadataTargetKind (node: ElementDeclarationNode): MetadataTargetKind | undefined {
  const value = node.targetKind?.value?.toLowerCase();
  return Object.values(MetadataTargetKind).find((k) => k.toLowerCase() === value);
}

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
    if (!isValidMetadataValue(attr.value)) {
      errors.push(new CompileError(
        errorCodes.invalidValue,
        `Custom setting '${name}' must be a string or a color literal`,
        attr.value || attr.name || attr,
      ));
    }
  });

  return errors;
}
