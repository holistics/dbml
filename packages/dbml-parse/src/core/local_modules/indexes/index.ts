import { isElementNode, isElementFieldNode, isExpressionAVariableNode } from '@/core/utils/expression';
import { last } from 'lodash-es';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  AttributeNode,
  ListExpressionNode,
  type SyntaxNode,
} from '@/core/types/nodes';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { type LocalModule } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import { aggregateSettingList, isVoid, Settings } from '@/core/utils/validate';
import { isExpressionAQuotedString } from '@/core/utils/expression';
import Report from '@/core/types/report';
import type Compiler from '@/compiler';
import IndexesValidator from './validate';

export const indexesModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Indexes)) {
      const result = new IndexesValidator(compiler, node).validate();
      return Report.create(undefined, result.errors, result.warnings);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Indexes)) {
      if (node.name) {
        return new Report(undefined, [new CompileError(CompileErrorCode.UNEXPECTED_NAME, 'An Indexes shouldn\'t have a name', node.name)]);
      }
      return new Report(undefined);
    }
    if (isElementFieldNode(node, ElementKind.Indexes)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Indexes)) {
      if (node.alias) {
        return new Report(undefined, [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'An Indexes shouldn\'t have an alias', node.alias)]);
      }
      return new Report(undefined);
    }
    if (isElementFieldNode(node, ElementKind.Indexes)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Indexes)) {
      if (node.attributeList) {
        return new Report(
          {},
          [
            new CompileError(
              CompileErrorCode.UNEXPECTED_SETTINGS,
              'An Indexes shouldn\'t have a setting list',
              node.attributeList,
            ),
          ],
        );
      }
      return new Report({});
    }
    if (isElementFieldNode(node, ElementKind.Indexes)) {
      const args = [node.callee, ...node.args];
      let settingsList: ListExpressionNode | undefined;
      if (last(args) instanceof ListExpressionNode) {
        settingsList = last(args) as ListExpressionNode;
      }

      if (!settingsList) return new Report({});

      const settingsReport = aggregateSettingList(settingsList);
      const errors = settingsReport.getErrors();
      const settingMap = settingsReport.getValue();
      const clean: Settings = {};

      for (const [name, attrs] of Object.entries(settingMap)) {
        switch (name) {
          case SettingName.Note:
          case SettingName.Name:
            if (attrs.length > 1) {
              attrs.forEach((attr: AttributeNode) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_INDEX_SETTING, `'${name}' can only appear once`, attr)));
            }
            attrs.forEach((attr: AttributeNode) => {
              if (!isExpressionAQuotedString(attr.value)) {
                errors.push(new CompileError(CompileErrorCode.INVALID_INDEX_SETTING_VALUE, `'${name}' must be a string`, attr));
              }
            });
            clean[name] = attrs;
            break;
          case SettingName.Unique:
          case SettingName.PK:
            if (attrs.length > 1) {
              attrs.forEach((attr: AttributeNode) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_INDEX_SETTING, `'${name}' can only appear once`, attr)));
            }
            attrs.forEach((attr: AttributeNode) => {
              if (!isVoid(attr.value)) {
                errors.push(new CompileError(CompileErrorCode.INVALID_INDEX_SETTING_VALUE, `'${name}' must not have a value`, attr));
              }
            });
            clean[name] = attrs;
            break;
          case SettingName.Type:
            if (attrs.length > 1) {
              attrs.forEach((attr: AttributeNode) => errors.push(new CompileError(CompileErrorCode.DUPLICATE_INDEX_SETTING, '\'type\' can only appear once', attr)));
            }
            attrs.forEach((attr: AttributeNode) => {
              if (!isExpressionAVariableNode(attr.value)) {
                errors.push(new CompileError(CompileErrorCode.INVALID_INDEX_SETTING_VALUE, '\'type\' must be "btree" or "hash"', attr));
              }
            });
            clean[name] = attrs;
            break;
          default:
            attrs.forEach((attr: AttributeNode) => errors.push(new CompileError(CompileErrorCode.UNKNOWN_INDEX_SETTING, `Unknown index setting '${name}'`, attr)));
        }
      }

      return new Report(clean, errors);
    }
    return Report.create(PASS_THROUGH);
  },
};
