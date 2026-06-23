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
  isValidColor,
  isValidName,
} from '@/core/utils/validate';
import { ALLOWED_METADATA_TARGET_KINDS } from '@/core/types';
import { extractValue } from '@/core/global_modules/metadata/interpret';

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

    const errors = subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }

      const subKind = sub.type.value.toLowerCase();
      if (!subKindMap[subKind]) subKindMap[subKind] = [];
      subKindMap[subKind].push(sub);

      switch (subKind) {
        case 'color':
        case 'headercolor':
          if (sub.body instanceof BlockExpressionNode) {
            return [
              new CompileError(
                CompileErrorCode.UNEXPECTED_COMPLEX_BODY,
                'A Custom element can only have an inline field',
                sub.body,
              ),
            ];
          }

          if (!isValidColor(sub.body?.callee)) {
            return [
              new CompileError(
                CompileErrorCode.INVALID_METADATA_FIELD,
                `'${sub.type.value}' must be a color literal`,
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
      if (valueNode !== undefined && !(valueNode instanceof EmptyNode) && extractValue(valueNode) === undefined) {
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
