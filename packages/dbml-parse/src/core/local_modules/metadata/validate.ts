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
import {
  isExpressionAVariableNode,
  isValidColor,
  isValidColumnType,
  isValidName,
} from '@/core/utils/validate';
import { ALLOWED_METADATA_TARGET_KINDS } from '@/core/types';

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
    const validateColumn = (field: FunctionApplicationNode) => {
      const errors: CompileError[] = [];
      if (!field.callee) {
        return [];
      }
      if (field.args.length === 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN, 'A column must have a type', field.callee!));
      }

      if (!isExpressionAVariableNode(field.callee)) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_NAME, 'A column name must be an identifier or a quoted identifier', field.callee));
      }

      if (field.args[0] && !isValidColumnType(field.args[0])) {
        errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_TYPE, 'Invalid column type', field.args[0]));
      }

      return errors;
    };
    const fieldErrors = fields.flatMap((field) => {
      return validateColumn(field);
    });

    return fieldErrors;
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
      // (string/number/boolean/identifier/color). The interpreter extracts the
      // value best-effort, so validation only rejects a complex (block) body.
      if (sub.body instanceof BlockExpressionNode) {
        return [
          new CompileError(
            CompileErrorCode.UNEXPECTED_COMPLEX_BODY,
            'A Metadata field can only have an inline value',
            sub.body,
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
