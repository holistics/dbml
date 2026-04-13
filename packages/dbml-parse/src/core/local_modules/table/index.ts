import {
  isElementNode, isElementFieldNode, destructureComplexVariable, extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import type {
  LocalModule,
} from '../types';
import {
  ArrayNode,
  SyntaxNode,
} from '@/core/types/nodes';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  isValidAlias, Settings,
} from '@/core/utils/validate';
import Report from '@/core/types/report';
import type Compiler from '@/compiler';
import TableValidator, {
  validateTableSettings, validateFieldSetting,
} from './validate';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';

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
        return new Report(undefined, [new CompileError(CompileErrorCode.NAME_NOT_FOUND, 'A Table must have a name', node)]);
      }
      if (node.name instanceof ArrayNode) {
        return new Report(undefined, [new CompileError(CompileErrorCode.INVALID_NAME, 'Invalid array as Table name, maybe you forget to add a space between the name and the setting list?', node.name)]);
      }
      return new Report(destructureComplexVariable(node.name));
    }
    if (isElementFieldNode(node, ElementKind.Table)) {
      const name = extractVariableFromExpression(node.callee);
      return new Report(name ? [name] : undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Table)) {
      if (!node.alias) return new Report(undefined);
      if (!isValidAlias(node.alias)) {
        return new Report(undefined, [new CompileError(CompileErrorCode.INVALID_ALIAS, 'Table aliases can only contains alphanumeric and underscore unless surrounded by double quotes', node.alias)]);
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
