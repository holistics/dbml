import {
  last,
} from 'lodash-es';
import type Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementKind, SettingName,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';
import {
  AttributeNode, ListExpressionNode, SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  destructureComplexVariable,
  extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  aggregateSettingList, isElementFieldNode, isElementNode, isExpressionAQuotedString, isValidName,
} from '@/core/utils/validate';
import {
  type LocalModule, type Settings,
} from '../types';
import EnumValidator from './validate';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';

export const enumModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Enum)) {
      return Report.create(undefined, new EnumValidator(compiler, node).validate());
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Enum)) {
      if (!node.name) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'An Enum must have a name', node),
        ]);
      }
      if (!isValidName(node.name)) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.INVALID_NAME, 'An Enum name must be of the form <enum> or <schema>.<enum>', node.name),
        ]);
      }
      const names = destructureComplexVariable(node.name);
      if (names?.length === 1) names.unshift(DEFAULT_SCHEMA_NAME);
      return new Report(names);
    }
    if (isElementFieldNode(node, ElementKind.Enum)) {
      const name = extractVariableFromExpression(node.callee);
      return new Report(name !== undefined
        ? [
            name,
          ]
        : undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Enum)) {
      if (node.alias) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'An Enum shouldn\'t have an alias', node.alias),
        ]);
      }
      return new Report(undefined);
    }
    if (isElementFieldNode(node, ElementKind.Enum)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Enum)) {
      if (node.attributeList) {
        return new Report({}, [
          new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'An Enum shouldn\'t have a setting list', node.attributeList),
        ]);
      }
      return new Report({});
    }
    if (isElementFieldNode(node, ElementKind.Enum)) {
      const args = [
        ...node.args,
      ];
      let settingsList: ListExpressionNode | undefined;
      if (last(args) instanceof ListExpressionNode) {
        settingsList = last(args) as ListExpressionNode;
      } else if (args[0] instanceof ListExpressionNode) {
        settingsList = args[0];
      }

      if (!settingsList) return new Report({});

      const settingsReport = aggregateSettingList(settingsList);
      const errors = settingsReport.getErrors();
      const settingMap = settingsReport.getValue();
      const clean: Settings = {};

      for (const [
        name,
        attrs,
      ] of Object.entries(settingMap)) {
        switch (name) {
          case SettingName.Note:
            if (attrs.length > 1) {
              attrs.forEach((attr: AttributeNode) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_ENUM_ELEMENT_SETTING, '\'note\' can only appear once', attr)));
            }
            attrs.forEach((attr: AttributeNode) => {
              if (!isExpressionAQuotedString(attr.value)) {
                errors.push(new CompileError(CompileErrorCode.INVALID_ENUM_ELEMENT_SETTING, '\'note\' must be a string', attr));
              }
            });
            clean[name] = attrs;
            break;
          default:
            attrs.forEach((attr: AttributeNode) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_ENUM_ELEMENT_SETTING, `Unknown enum field setting '${name}'`, attr)));
        }
      }

      return new Report<Settings>(clean, errors);
    }
    return Report.create(PASS_THROUGH);
  },
};
