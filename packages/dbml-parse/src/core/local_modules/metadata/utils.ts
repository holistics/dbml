import { CompileError, CompileErrorCode, CompileWarning } from '@/core/types';
import type { AttributeNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { extractMetadataValue, invalidMetadataValueError, legacyMetadataValueDiagnostic } from '@/core/utils/interpret';

type CustomMetadataErrorCodes = { duplicate: CompileErrorCode; invalidValue: CompileErrorCode };

function duplicateErrors (name: string, attrs: AttributeNode[], code: CompileErrorCode): CompileError[] {
  if (attrs.length <= 1) return [];
  return attrs.map((attr) => new CompileError(code, `'${name}' can only appear once`, attr));
}

export function validateCustomInlineMetadata (
  name: string,
  attrs: AttributeNode[],
  errorCodes: CustomMetadataErrorCodes,
): CompileError[] {
  const errors = duplicateErrors(name, attrs, errorCodes.duplicate);

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

// Like validateCustomInlineMetadata, but a bare text value (`owner: data team`) is a deprecation warning instead of an error.
// Only for Dep settings lists, which accepted unquoted text before v13
export function validateLegacyCustomInlineMetadata (
  name: string,
  attrs: AttributeNode[],
  errorCodes: CustomMetadataErrorCodes & { deprecatedValue: CompileErrorCode },
): Report<void> {
  const errors = duplicateErrors(name, attrs, errorCodes.duplicate);
  const warnings: CompileWarning[] = [];

  attrs.forEach((attr) => {
    const diagnostics = legacyMetadataValueDiagnostic(
      { invalid: errorCodes.invalidValue, deprecated: errorCodes.deprecatedValue },
      `Custom setting '${name}'`,
      attr.value,
      attr.value || attr.name || attr,
    );
    errors.push(...diagnostics.errors);
    warnings.push(...diagnostics.warnings);
  });

  return new Report(undefined, errors, warnings);
}
