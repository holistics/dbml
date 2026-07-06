import { partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  ArrayNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  MetadataDeclarationNode,
  SyntaxNode,
  WildcardNode,
} from '@/core/types/nodes';
import { isValidMetadataValue, isValidName } from '@/core/utils/validate';
import { ALLOWED_METADATA_TARGET_KINDS } from '@/core/types';
import { BUILTIN_METADATA_FIELD_HELPERS, findBuiltinSettingName } from '@/core/global_modules/metadata/builtin';

export default class MetadataValidator {
  constructor (private compiler: Compiler, private declarationNode: MetadataDeclarationNode) {}

  validate (): CompileError[] {
    return [
      ...this.validateTargetKind(),
      ...this.validateTargetName(this.declarationNode.targetName),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateTargetKind (): CompileError[] {
    if (!this.declarationNode.getTargetKind()) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_METADATA_TARGET_KIND,
          `A Metadata target kind must be one of: ${ALLOWED_METADATA_TARGET_KINDS.join(', ')}`,
          this.declarationNode.targetKind ?? this.declarationNode,
        ),
      ];
    }

    return [];
  }

  private validateTargetName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [
        new CompileError(
          CompileErrorCode.NAME_NOT_FOUND,
          'A Metadata target must have a name',
          this.declarationNode,
        ),
      ];
    }
    if (nameNode instanceof ArrayNode) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_NAME,
          'Invalid array as Metadata target\'s name.',
          nameNode,
        ),
      ];
    }
    if (nameNode instanceof WildcardNode) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_NAME,
          'Wildcard (*) is not allowed as a Metadata target\'s name',
          nameNode,
        ),
      ];
    }
    if (!isValidName(nameNode)) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_NAME,
          'A Metadata target\'s name must be a schema-qualified name',
          nameNode,
        ),
      ];
    }

    return [];
  }

  private validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) return [];

    if (body instanceof FunctionApplicationNode) {
      return [
        new CompileError(
          CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
          'A Metadata\'s body must be a block',
          body,
        ),
      ];
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return [
      ...this.validateFields(fields),
      ...this.validateSubElements(subs),
    ];
  }

  private validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    // A Metadata body may only contain 'key: value' fields (parsed as ElementDeclarationNode).
    // => A expression such as `id int` parses as a FunctionApplicationNode and is never valid here.
    return fields.map((field) => new CompileError(
      CompileErrorCode.INVALID_METADATA_FIELD,
      'A Metadata field must use the \'key: value\' syntax',
      field,
    ));
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    const keyValuesMap: Record<string, ElementDeclarationNode[]> = {};
    const targetKind = this.declarationNode.getTargetKind();

    const errors = subs.flatMap((sub) => {
      if (!sub.type) return [];

      const key = sub.type.value.toLowerCase();
      if (!keyValuesMap[key]) keyValuesMap[key] = [];
      keyValuesMap[key].push(sub);

      // A key that names a builtin setting for this target kind is validated as
      // that inline value type (it will be written onto the typed field).
      // Color-/note-named keys on a target that does NOT support them fall
      // through to generic scalar validation and stay as custom metadata.
      const builtinKey = findBuiltinSettingName(targetKind, key);
      // A matrixed key without a spec falls through to generic custom-metadata
      // validation (the write pass skips it too), so the two stay in agreement.
      const spec = builtinKey ? BUILTIN_METADATA_FIELD_HELPERS[builtinKey] : undefined;
      if (builtinKey && spec) {
        if (sub.body instanceof BlockExpressionNode) {
          return [
            new CompileError(
              CompileErrorCode.UNEXPECTED_COMPLEX_BODY,
              'A Metadata field can only have an inline value',
              sub.body,
            ),
          ];
        }

        if (!spec.validate(sub.body?.callee)) {
          return [
            new CompileError(
              CompileErrorCode.INVALID_METADATA_FIELD,
              `'${sub.type.value}' must be ${spec.message}`,
              sub,
            ),
          ];
        }

        return [];
      }

      // Generic metadata field: a single inline scalar value
      // (string/number/boolean/identifier/color). Validation rejects a complex
      // (block) body and positively verifies the value is an admissible scalar.
      if (sub.body instanceof BlockExpressionNode) {
        return [
          new CompileError(
            CompileErrorCode.UNEXPECTED_COMPLEX_BODY,
            'A Metadata field can only have an inline value',
            sub.body,
          ),
        ];
      }

      // Only validate the value when a real callee is present. When a key has
      // no value the parser emits INVALID_OPERAND via error recovery and
      // synthesises a FunctionApplicationNode whose callee is an EmptyNode —
      // we must not pile on with a second INVALID_METADATA_FIELD in that case.
      const valueNode = sub.body instanceof FunctionApplicationNode ? sub.body.callee : undefined;
      if (!isValidMetadataValue(valueNode)) {
        return [
          new CompileError(
            CompileErrorCode.INVALID_METADATA_FIELD,
            'A Metadata field value must be a string or a color literal',
            sub.body ?? sub,
          ),
        ];
      }

      return [];
    });

    errors.push(...Object.values(keyValuesMap).flatMap((subList) => {
      if (subList.length <= 1) return [];

      return subList.map((sub) => new CompileError(
        CompileErrorCode.DUPLICATE_METADATA_FIELD,
        'Duplicate Metadata fields are defined',
        sub,
      ));
    }));

    return errors;
  }
}
