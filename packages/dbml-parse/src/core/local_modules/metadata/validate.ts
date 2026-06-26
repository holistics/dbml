import { partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  ArrayNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  EmptyNode,
  FunctionApplicationNode,
  MetadataDeclarationNode,
  SyntaxNode,
  WildcardNode,
} from '@/core/types/nodes';
import {
  isExpressionAQuotedString,
  isValidColorOrNone,
  isValidMetadataValue,
  isValidName,
} from '@/core/utils/validate';
import { ALLOWED_METADATA_TARGET_KINDS } from '@/core/types';
import { extractValue } from '@/core/global_modules/metadata/interpret';
import { OverlapValueKind, findOverlapKey } from '@/core/global_modules/metadata/overlap';

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
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [
        new CompileError(
          CompileErrorCode.UNEXPECTED_SIMPLE_BODY,
          'A Metadata\'s body must be a block',
          body,
        ),
      ];
    }

    const [
      fields,
      subs,
    ] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateFields(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    // A Metadata body may only contain 'key: value' fields (parsed as
    // ElementDeclarationNode). A bare expression such as `id int` parses as a
    // FunctionApplicationNode and is never valid here.
    return fields.map((field) => new CompileError(
      CompileErrorCode.INVALID_METADATA_FIELD,
      'A Metadata field must use the \'key: value\' syntax',
      field,
    ));
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    const subKindMap: Record<string, ElementDeclarationNode[]> = {};
    const targetKind = this.declarationNode.getTargetKind();

    const errors = subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }

      const subKind = sub.type.value.toLowerCase();
      if (!subKindMap[subKind]) subKindMap[subKind] = [];
      subKindMap[subKind].push(sub);

      // A key that overlaps a supported inline setting for this target kind is
      // validated as that inline value type (it will be promoted onto the typed
      // field). Color-/note-named keys on a target that does NOT support them
      // fall through to generic scalar validation and stay as custom metadata.
      const overlap = findOverlapKey(targetKind, subKind);
      if (overlap) {
        if (sub.body instanceof BlockExpressionNode) {
          return [
            new CompileError(
              CompileErrorCode.UNEXPECTED_COMPLEX_BODY,
              'A Metadata field can only have an inline value',
              sub.body,
            ),
          ];
        }

        const isColorReshape = overlap.reshape === OverlapValueKind.Color
          || overlap.reshape === OverlapValueKind.HeaderColor;
        if (isColorReshape && !isValidColorOrNone(sub.body?.callee)) {
          return [
            new CompileError(
              CompileErrorCode.INVALID_METADATA_FIELD,
              `'${sub.type.value}' must be a color literal or 'none'`,
              sub,
            ),
          ];
        }

        if (overlap.reshape === OverlapValueKind.Note && !isExpressionAQuotedString(sub.body?.callee)) {
          return [
            new CompileError(
              CompileErrorCode.INVALID_METADATA_FIELD,
              `'${sub.type.value}' must be a string`,
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
            'A Metadata field value must be a scalar value',
            sub.body ?? sub,
          ),
        ];
      }

      return [];
    });

    errors.push(...Object.values(subKindMap).flatMap((subList) => {
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
