import type Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';
import {
  ArrayNode,
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  destructureComplexVariable, extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  Settings, isElementFieldNode, isElementNode, isValidAlias,
  isValidPartialInjection,
} from '@/core/utils/validate';
import type {
  LocalModule,
} from '../types';
import TableValidator, {
  validateFieldSetting, validateTableSettings,
} from './validate';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';

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
