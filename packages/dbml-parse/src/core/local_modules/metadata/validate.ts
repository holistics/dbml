import { partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  SyntaxNode,
  WildcardNode,
} from '@/core/types/nodes';
import { isValidMetadataValue, isValidName } from '@/core/utils/validate';
import { SettingName } from '@/core/types';
import { MetadataTargetKind } from '@/core/types/symbol';
import { METADATA_FIELDS_BY_KIND } from '@/core/global_modules/metadata/fieldRegistry';
import { getMetadataTargetKind } from './utils';

export default class MetadataValidator {
  constructor (private compiler: Compiler, private declarationNode: ElementDeclarationNode) {}

  validate (): CompileError[] {
    return [
      ...this.validateTargetKind(),
      ...this.validateTargetName(this.declarationNode.name),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateTargetKind (): CompileError[] {
    if (!getMetadataTargetKind(this.declarationNode)) {
      return [
        new CompileError(
          CompileErrorCode.INVALID_METADATA_TARGET_KIND,
          `A Metadata target kind must be one of: ${Object.values(MetadataTargetKind).join(', ')}`,
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
          'A Metadata target\'s name must be of the form <schema>.<table>, <table>.<column>, <schema>.<table>.<column> or a single identifier',
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
    // => An expression such as `id int` parses as a FunctionApplicationNode and is never valid here.
    return fields.map((field) => new CompileError(
      CompileErrorCode.INVALID_METADATA_FIELD,
      'A Metadata field must use the \'key: value\' syntax',
      field,
    ));
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    const keyValuesMap: Record<string, ElementDeclarationNode[]> = {};
    const targetKind = getMetadataTargetKind(this.declarationNode);

    const errors = subs.flatMap((sub) => {
      if (!sub.type) return [];

      // Metadata value only accept a string/color. Validation rejects a complex (block) body.
      if (sub.body instanceof BlockExpressionNode) {
        return [
          new CompileError(
            CompileErrorCode.UNEXPECTED_COMPLEX_BODY,
            'A Metadata field can only have an inline value',
            sub.body,
          ),
        ];
      }

      const key = sub.type.value.toLowerCase();
      if (!keyValuesMap[key]) keyValuesMap[key] = [];
      keyValuesMap[key].push(sub);

      // If a key matches a builtin setting for the target element, validate with the element's specs
      const builtinSpecs = targetKind ? METADATA_FIELDS_BY_KIND[targetKind]?.[key as SettingName] : undefined;
      if (builtinSpecs) {
        if (!builtinSpecs.isValidBuiltinFieldValue(sub.body?.callee)) {
          return [
            new CompileError(
              CompileErrorCode.INVALID_METADATA_FIELD,
              builtinSpecs.message,
              sub,
            ),
          ];
        }

        return [];
      }

      // Only validate the value when a real callee is present. Missing callee is handled as `parse` phase
      if (!isValidMetadataValue(sub.body?.callee)) {
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
