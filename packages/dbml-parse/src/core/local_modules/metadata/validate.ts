import { partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  ArrayNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ListExpressionNode,
  SyntaxNode,
  WildcardNode,
} from '@/core/types/nodes';
import {
  getElementSubKind,
  isExpressionAVariableNode,
  isValidColor,
  isValidColumnType,
  isValidName,
} from '@/core/utils/validate';
import { ALLOWED_METADATA_TARGET_KINDS, ElementKind, MetadataTargetKind } from '@/core/types';
import { SyntaxToken } from '@/core/types/tokens';

export function isValidMetadataSubKind (metadataNode: ElementDeclarationNode): metadataNode is ElementDeclarationNode & { subKind: SyntaxToken & { value: MetadataTargetKind } } {
  const kind = metadataNode.getElementKind();
  if (!kind) return false;

  const subKind = getElementSubKind(kind, metadataNode.subKind);
  return !!subKind;
};

export default class MetadataValidator {
  private declarationNode: ElementDeclarationNode & { type: { value: ElementKind.Metadata } };
  private compiler: Compiler;

  constructor (
    compiler: Compiler,
    declarationNode: ElementDeclarationNode & { type: { value: ElementKind.Metadata } },
  ) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateSubKind(),
      ...this.validateName(this.declarationNode.name),
      ...this.validateAlias(this.declarationNode.alias),
      ...this.validateSettingList(this.declarationNode.attributeList),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_METADATA_CONTEXT,
          'Metadata must appear top-level',
          this.declarationNode,
        ),
      ];
    }
    return [];
  }

  private validateSubKind (): CompileError[] {
    const kind = this.declarationNode.getElementKind();
    if (!kind) return [];

    if (!isValidMetadataSubKind(this.declarationNode)) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_METADATA_TARGET_KIND,
          `A Metadata hola: ${ALLOWED_METADATA_TARGET_KINDS.join(', ')}`,
          this.declarationNode.subKind ?? this.declarationNode,
        ),
      ];
    }

    return [];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      return [
        new CompileError(
          CompileErrorCode.NAME_NOT_FOUND,
          'A Metadata must have a name',
          this.declarationNode,
        ),
      ];
    }
    if (nameNode instanceof ArrayNode) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_NAME,
          'Invalid array as Metadata name, maybe you forget to add a space between the name and the setting list?',
          nameNode,
        ),
      ];
    }
    if (nameNode instanceof WildcardNode) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_NAME,
          'Wildcard (*) is not allowed as a Metadata name',
          nameNode,
        ),
      ];
    }
    if (!isValidName(nameNode)) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_NAME,
          'A Metadata name must be schema-qualified name',
          nameNode,
        ),
      ];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [
        new CompileError(
          CompileErrorCode.UNEXPECTED_ALIAS,
          'A Metadata shouldn\'t have an alias',
          aliasNode,
        ),
      ];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (!settingList) return [];

    return [
      new CompileError(
        CompileErrorCode.UNEXPECTED_SETTINGS,
        'A Metadata shouldn\'t have a setting list',
        settingList,
      ),
    ];
  }

  private validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [
        new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Metadata\'s body must be a block', body),
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
      if (subList.length > 1) return subList.map((sub) => new CompileError(CompileErrorCode.DUPLICATE_METADATA_FIELD, 'Duplicate Metadata fields are defined', sub));
      return [];
    }));

    return errors;
  }
}
