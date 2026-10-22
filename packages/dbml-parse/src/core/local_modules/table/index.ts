import { forIn, last } from 'lodash-es';
import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import {
  ArrayNode,
  AttributeNode,
  ExpressionNode,
  FunctionExpressionNode,
  ListExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import { destructureComplexVariable, extractVariableFromExpression } from '@/core/utils/expression';
import {
  Settings, aggregateSettingList, isElementFieldNode, isElementNode, isExpressionAnIdentifierNode,
  isUnaryDependency, isUnaryRelationship, isValidAlias, isValidDefaultValue, isValidPartialInjection,
} from '@/core/utils/validate';
import { TABLE_METADATA_FIELDS, COLUMN_METADATA_FIELDS } from '@/core/global_modules/metadata/registries';
import type { LocalModule } from '../types';
import TableValidator from './validate';
import { validateCustomInlineMetadata } from '../metadata/utils';
import { DEFAULT_SCHEMA_NAME } from '@/constants';

export const tableModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Table)) {
      return Report.create(undefined, new TableValidator(compiler, node).validate());
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Table)) {
      if (!node.name) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'A Table must have a name', node),
        ]);
      }
      if (node.name instanceof ArrayNode) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.INVALID_NAME, 'Invalid array as Table name, maybe you forget to add a space between the name and the setting list?', node.name),
        ]);
      }
      const names = destructureComplexVariable(node.name);
      if (names?.length === 1) names.unshift(DEFAULT_SCHEMA_NAME);
      return new Report(names);
    }
    if (isElementFieldNode(node, ElementKind.Table)) {
      if (isValidPartialInjection(node.callee)) {
        const name = extractVariableFromExpression(node.callee.expression);
        return new Report(name
          ? [
              name,
            ]
          : undefined);
      }
      const name = extractVariableFromExpression(node.callee);
      return new Report(name
        ? [
            name,
          ]
        : undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Table)) {
      if (!node.alias) return new Report(undefined);
      if (!isValidAlias(node.alias)) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.INVALID_ALIAS, 'Table aliases can only contain alphanumeric and underscore unless surrounded by double quotes', node.alias),
        ]);
      }
      return new Report(extractVariableFromExpression(node.alias));
    }
    if (isElementFieldNode(node, ElementKind.Table)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Table)) {
      if (!node.attributeList) return new Report({});
      return validateTableSettings(node.attributeList);
    }
    if (isElementFieldNode(node, ElementKind.Table)) {
      const remains = node.args.slice(1);
      return validateFieldSetting(remains);
    }
    return Report.create(PASS_THROUGH);
  },
};

function validateTableSettings (settingList?: ListExpressionNode): Report<Settings> {
  const aggReport = aggregateSettingList(settingList);
  const errors = aggReport.getErrors();
  const settingMap = aggReport.getValue();

  forIn(settingMap, (attrs, name) => {
    switch (name) {
      case SettingName.HeaderColor:
      case SettingName.Note: {
        const field = TABLE_METADATA_FIELDS[name];
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_TABLE_SETTING, `'${name}' can only appear once`, attr)));
        }

        attrs.forEach((attr) => {
          if (field.parse(attr.value) === undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING_VALUE, field.invalidError.message, attr.value || attr.name || attr));
          }
        });
        break; }
      case SettingName.Dep:
        attrs.forEach((attr) => {
          if (!isUnaryDependency(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_TABLE_SETTING_VALUE, '\'dep\' must be `-> target` or `<- source`', attr.value || attr.name!));
          }
        });
        break;
      default:
        // Any non-builtin key is free-form inline custom metadata
        errors.push(
          ...validateCustomInlineMetadata(name, attrs, {
            duplicate: CompileErrorCode.DUPLICATE_TABLE_SETTING,
            invalidValue: CompileErrorCode.INVALID_TABLE_SETTING_VALUE,
          }),
        );
    }
  });
  return new Report(settingMap, errors);
}

// This is needed to support legacy inline settings
function validateFieldSetting (parts: ExpressionNode[]): Report<Settings> {
  if (!parts.slice(0, -1).every(isExpressionAnIdentifierNode) || !parts.slice(-1).every((p) => isExpressionAnIdentifierNode(p) || p instanceof ListExpressionNode)) {
    return new Report({}, parts.map((part) => new CompileError(CompileErrorCode.INVALID_COLUMN, 'These fields must be some inline settings optionally ended with a setting list', part)));
  }

  if (parts.length === 0) {
    return new Report({});
  }

  let settingList: ListExpressionNode | undefined;
  if (last(parts) instanceof ListExpressionNode) {
    settingList = parts.pop() as ListExpressionNode;
  }

  const aggReport = aggregateSettingList(settingList);
  const errors = aggReport.getErrors();
  const settingMap = aggReport.getValue();

  parts.forEach((part) => {
    const name = (extractVariableFromExpression(part) ?? '').toLowerCase();
    if (name !== SettingName.PK && name !== SettingName.Unique) {
      errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'Inline column settings can only be `pk` or `unique`', part));
      return;
    }
    if (settingMap[name] === undefined) {
      settingMap[name] = [
        part as PrimaryExpressionNode,
      ];
    } else {
      settingMap[name]!.push(part as PrimaryExpressionNode);
    }
  });

  const pkAttrs = settingMap[SettingName.PK] || [];
  const pkeyAttrs = settingMap[SettingName.PrimaryKey] || [];
  if (pkAttrs.length >= 1 && pkeyAttrs.length >= 1) {
    errors.push(
      ...[
        ...pkAttrs,
        ...pkeyAttrs,
      ]
        .map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'Either one of \'primary key\' and \'pk\' can appear', attr)),
    );
  }

  forIn(settingMap, (attrs, name) => {
    switch (name) {
      case SettingName.Note: {
        const field = COLUMN_METADATA_FIELDS[name];
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, `'${name}' can only appear once`, attr)));
        }

        attrs.forEach((attr) => {
          if (field.parse(attr.value) === undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, field.invalidError.message, attr.value || attr.name || attr));
          }
        });
        break; }
      case SettingName.Ref:
        attrs.forEach((attr) => {
          if (!isUnaryRelationship(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'ref\' must be a valid unary relationship', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.PrimaryKey:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, 'primary key can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'primary key\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.PK:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'pk\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr instanceof AttributeNode && attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'pk\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.NotNull: {
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'not null\' can only appear once', attr)));
        }
        const nullAttrs = settingMap[SettingName.Null] || [];
        if (attrs.length >= 1 && nullAttrs.length >= 1) {
          errors.push(
            ...[
              ...attrs,
              ...nullAttrs,
            ]
              .map((attr) => new CompileError(CompileErrorCode.CONFLICTING_SETTING, '\'not null\' and \'null\' can not be set at the same time', attr)),
          );
        }
        attrs.forEach((attr) => {
          if (attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'not null\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      }
      case SettingName.Null:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'null\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'null\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.Unique:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'unique\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr instanceof AttributeNode && attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'unique\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.Increment:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'increment\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (attr instanceof AttributeNode && attr.value !== undefined) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'increment\' must not have a value', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.Default:
        if (attrs.length > 1) {
          errors.push(...attrs.map((attr) => new CompileError(CompileErrorCode.DUPLICATE_COLUMN_SETTING, '\'default\' can only appear once', attr)));
        }
        attrs.forEach((attr) => {
          if (!isValidDefaultValue(attr.value)) {
            errors.push(new CompileError(
              CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
              '\'default\' must be an enum value, a string literal, number literal, function expression, true, false or null',
              attr.value || attr.name!,
            ));
          }
        });
        break;
      case SettingName.Check:
        attrs.forEach((attr) => {
          if (!(attr.value instanceof FunctionExpressionNode)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'check\' must be a function expression', attr.value || attr.name!));
          }
        });
        break;
      case SettingName.Dep:
        attrs.forEach((attr) => {
          if (!isUnaryDependency(attr.value)) {
            errors.push(new CompileError(CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, '\'dep\' must be a valid unary relationship', attr.value || attr.name!));
          }
        });
        break;

      default:
        // Any non-builtin key is free-form inline custom metadata
        errors.push(
          ...validateCustomInlineMetadata(name, attrs, {
            duplicate: CompileErrorCode.DUPLICATE_COLUMN_SETTING,
            invalidValue: CompileErrorCode.INVALID_COLUMN_SETTING_VALUE,
          }),
        );
    }
  });
  return new Report(settingMap, errors);
}
