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
import { ALLOWED_METADATA_TARGET_KINDS, SettingName } from '@/core/types';
import { MetadataTargetKind } from '@/core/types/symbol';
import { COLUMN_FIELD_SPECS, TABLE_FIELD_SPECS } from '@/core/local_modules/table/validate';
import { TABLEGROUP_FIELD_SPECS } from '@/core/local_modules/tableGroup/validate';
import { NOTE_FIELD_SPECS } from '@/core/local_modules/note/validate';
import { FieldValidateMap } from '@/core/global_modules/metadata/fieldSpec';

// Static per-target-kind routing to each element's builtin-field validation map.
// The metadata element depends on the target element's rules; this record is the
// only place that knows which element owns which kind. Kinds without builtin
// promotable fields (e.g. Schema) are simply absent -> generic custom-metadata
// validation for every key.
const METADATA_VALIDATE_MAPS: Partial<Record<MetadataTargetKind, FieldValidateMap<any>>> = {
  [MetadataTargetKind.Table]: TABLE_FIELD_SPECS,
  [MetadataTargetKind.Column]: COLUMN_FIELD_SPECS,
  [MetadataTargetKind.TableGroup]: TABLEGROUP_FIELD_SPECS,
  [MetadataTargetKind.Note]: NOTE_FIELD_SPECS,
};

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

      // A key that names a builtin setting for this target kind is validated by
      // the target element's own spec (it will be written onto the typed field).
      // Color-/note-named keys on a target that does NOT support them are absent
      // from the map and fall through to generic scalar validation, staying as
      // custom metadata. The write pass routes through the same per-kind maps, so
      // validation and writing agree by construction.
      // `key` is a free-form lowercased string; a non-builtin key simply misses
      // the map (undefined) and falls through to generic validation below.
      const spec = targetKind ? METADATA_VALIDATE_MAPS[targetKind]?.[key as SettingName] : undefined;
      if (spec) {
        if (sub.body instanceof BlockExpressionNode) {
          return [
            new CompileError(
              CompileErrorCode.UNEXPECTED_COMPLEX_BODY,
              'A Metadata field can only have an inline value',
              sub.body,
            ),
          ];
        }

        if (!spec.predicate(sub.body?.callee)) {
          return [
            new CompileError(
              CompileErrorCode.INVALID_METADATA_FIELD,
              spec.message,
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
