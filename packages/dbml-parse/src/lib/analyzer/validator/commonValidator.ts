import { forIn, last } from 'lodash';
import { isExpressionAnIdentifierNode, isExpressionAQuotedString } from '../../parser/utils';
import { CompileError, CompileErrorCode } from '../../errors';
import {
  AttributeNode,
  ElementDeclarationNode,
  ExpressionNode,
  ListExpressionNode,
  PrimaryExpressionNode,
  VariableNode,
} from '../../parser/nodes';
import {
  aggregateSettingList, isUnaryRelationship, isValidColor, isValidDefaultValue, isVoid,
} from './utils';
import { extractVarNameFromPrimaryVariable } from '../utils';
import { ElementKindName, SettingName, TopLevelElementKindName } from '../types';

// Include static validator methods for common cases
export default class CommonValidator {
  static validateUniqueSetting (
    settingName: string,
    attrs: (AttributeNode | PrimaryExpressionNode)[],
    settingNamesToValidate: string[],
    errorCode: CompileErrorCode,
  ) {
    if (settingNamesToValidate.includes(settingName) && attrs.length > 1) {
      return attrs.map((attr) => new CompileError(errorCode, `'${settingName}' can only appear once`, attr));
    }
    return [];
  }

  // This is needed to support legacy inline settings
  // Used for Table and TableFragment columns
  // e.g. `id int pk unique [note: 'abc']`
  static validateColumnSettings (parts: (ExpressionNode | PrimaryExpressionNode & { expression: VariableNode })[]) {
    if (parts.length === 0) return [];

    // algorithm: if last part is not list expression, then it must be identifer node
    // so we can check it with the remaining parts as well
    const isLastPartListExpression = last(parts) instanceof ListExpressionNode;
    const firstParts = (isLastPartListExpression ? parts.slice(0, -1) : parts) as (PrimaryExpressionNode & { expression: VariableNode })[];

    if (!firstParts.every(isExpressionAnIdentifierNode) && !isLastPartListExpression) {
      return [...parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part))];
    }

    const settingList = isLastPartListExpression
      ? last(parts) as ListExpressionNode
      : undefined;

    const aggReport = aggregateSettingList(settingList);
    const errors = aggReport.getErrors();
    const settingMap: Record<SettingName | string, (AttributeNode | PrimaryExpressionNode)[]> = aggReport.getValue();

    firstParts.forEach((part) => {
      const name = extractVarNameFromPrimaryVariable(part).unwrap_or('').toLowerCase();

      if (name !== SettingName.PK && name !== SettingName.Unique) {
        errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Inline column settings can only be `pk` or `unique`', part));
        return;
      }

      if (settingMap[name] === undefined) settingMap[name] = [];
      settingMap[name].push(part);
    });

    // Same for both Table and TableFragment columns
    const UNIQUE_COLUMN_SETTINGS: string[] = [
      SettingName.Note,
      SettingName.Ref,
      SettingName.PKey,
      SettingName.PK,
      SettingName.NotNull,
      SettingName.Null,
      SettingName.Unique,
      SettingName.Increment,
      SettingName.Default,
    ];

    forIn(settingMap, (attrs, name) => {
      if (!attrs) return;

      errors.push(...CommonValidator.validateUniqueSetting(name, attrs, UNIQUE_COLUMN_SETTINGS, CompileErrorCode.DUPLICATE_COLUMN_SETTING));
      errors.push(...CommonValidator.validateNonValueSetting(name, attrs));

      switch (name) {
        case SettingName.PK:
          errors.push(...CommonValidator.validatePrimaryKeyAndPKSetting(attrs, settingMap[SettingName.PKey]));
          break;

        case SettingName.Note:
          errors.push(...CommonValidator.validateNoteSetting(attrs as AttributeNode[], CompileErrorCode.INVALID_COLUMN_SETTING_VALUE));
          break;

        case SettingName.Ref:
          (attrs as AttributeNode[]).forEach((attr) => {
            if (!isUnaryRelationship(attr.value)) {
              errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'ref\' must be a valid unary relationship', attr.value || attr.name!));
            }
          });
          break;

        case SettingName.Null:
          errors.push(...CommonValidator.validateNullAndNotNullSetting(attrs, settingMap[SettingName.NotNull]));
          break;

        case SettingName.Default:
          (attrs as AttributeNode[]).forEach((attr) => {
            if (!isValidDefaultValue(attr.value)) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
                '\'default\' must be a string literal, number literal, function expression, true, false or null',
                attr.value || attr.name!,
              ));
            }
          });
          break;

        // These cases already validated with unique setting validator
        case SettingName.PKey:
        case SettingName.Unique:
        case SettingName.NotNull:
        case SettingName.Increment:
          break;

        default:
          attrs.forEach((attr) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_COLUMN_SETTING, `Unknown column setting '${name}'`, attr)));
      }
    });

    return errors;
  }

  static validateNullAndNotNullSetting (
    nullAttrs: (PrimaryExpressionNode | AttributeNode)[] | undefined,
    notNullAttrs: (PrimaryExpressionNode | AttributeNode)[] | undefined,
  ) {
    if (notNullAttrs === undefined || nullAttrs === undefined) return [];

    if (notNullAttrs.length >= 1 && nullAttrs.length >= 1) {
      return [...notNullAttrs, ...nullAttrs].map((attr) => new CompileError(
        CompileErrorCode.CONFLICTING_SETTING,
        '\'not null\' and \'null\' can not be set at the same time',
        attr,
      ));
    }

    return [];
  }

  static validatePrimaryKeyAndPKSetting (
    pkAttrs: (PrimaryExpressionNode | AttributeNode)[] | undefined,
    pkeyAttrs: (PrimaryExpressionNode | AttributeNode)[] | undefined,
  ) {
    if (pkAttrs === undefined || pkeyAttrs === undefined) return [];

    if (pkAttrs.length >= 1 && pkeyAttrs.length >= 1) {
      return [...pkAttrs, ...pkeyAttrs].map((attr) => new CompileError(
        CompileErrorCode.DUPLICATE_COLUMN_SETTING,
        'Either one of \'primary key\' and \'pk\' can appear',
        attr,
      ));
    }

    return [];
  }

  static validateNonValueSetting (settingName: string, attrs: (AttributeNode | PrimaryExpressionNode)[]) {
    const errors: CompileError[] = [];

    const nonValueAttributeNames = [
      SettingName.PKey,
      SettingName.PK,
      SettingName.NotNull,
      SettingName.Null,
      SettingName.Unique,
      SettingName.Increment,
    ] as string[];

    if (nonValueAttributeNames.includes(settingName)) {
      attrs.forEach((attr) => {
        if (attr instanceof AttributeNode && !isVoid(attr.value)) {
          errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, `'${settingName}' must not have a value`, attr.value || attr.name!));
        }
      });
    }
    return errors;
  }

  static validateColorSetting (
    settingName: string,
    attrs: AttributeNode[],
    errorCode: CompileErrorCode,
  ) {
    return attrs.flatMap((attr) => {
      if (!isValidColor(attr.value)) {
        return [new CompileError(errorCode, `'${settingName}' must be a color literal`, attr.value || attr.name!)];
      }

      return [];
    });
  }

  static validateNoteSetting (attrs: AttributeNode[], errorCode: CompileErrorCode) {
    return attrs
      .filter((attr) => !isExpressionAQuotedString(attr.value))
      .map((attr) => new CompileError(
        errorCode,
        '\'note\' must be a string literal',
        attr.value || attr.name!,
      ));
  }

  static validateTopLevelContext (
    declarationNode: ElementDeclarationNode,
    elementKindName: TopLevelElementKindName,
  ) {
    const errorCodeBySymbolKind: Record<TopLevelElementKindName, CompileErrorCode> = {
      [ElementKindName.Table]: CompileErrorCode.INVALID_TABLE_CONTEXT,
      [ElementKindName.Enum]: CompileErrorCode.INVALID_ENUM_CONTEXT,
      [ElementKindName.TableGroup]: CompileErrorCode.INVALID_TABLEGROUP_CONTEXT,
      [ElementKindName.TableFragment]: CompileErrorCode.INVALID_TABLE_FRAGMENT_CONTEXT,
      [ElementKindName.Project]: CompileErrorCode.INVALID_PROJECT_CONTEXT,
      [ElementKindName.Ref]: CompileErrorCode.INVALID_REF_CONTEXT,
    };

    if (declarationNode.parent instanceof ElementDeclarationNode) {
      return [new CompileError(
        errorCodeBySymbolKind[elementKindName],
        `${elementKindName} must appear top-level`,
        declarationNode,
      )];
    }

    return [];
  }
}
