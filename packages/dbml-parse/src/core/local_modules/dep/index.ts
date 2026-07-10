import { last } from 'lodash-es';
import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind } from '@/core/types/keywords';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { ListExpressionNode, SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { destructureComplexVariable } from '@/core/utils/expression';
import {
  Settings, isElementFieldNode, isElementNode, isSimpleName,
} from '@/core/utils/validate';
import { type LocalModule } from '../types';
import DepValidator, { validateDepSettings } from './validate';

export const depModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Dep)) {
      return Report.create(undefined, new DepValidator(compiler, node).validate());
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Dep)) {
      if (!node.name) return new Report(undefined);
      if (!isSimpleName(node.name)) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.INVALID_NAME, 'A Dep\'s name is optional or must be an identifier or a quoted identifier', node.name),
        ]);
      }
      return new Report(destructureComplexVariable(node.name));
    }
    if (isElementFieldNode(node, ElementKind.Dep)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Dep)) {
      if (node.alias) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Dep shouldn\'t have an alias', node.alias),
        ]);
      }
      return new Report(undefined);
    }
    if (isElementFieldNode(node, ElementKind.Dep)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Dep)) {
      if (node.attributeList) {
        return validateDepSettings(node.attributeList);
      }
      return new Report({});
    }
    if (isElementFieldNode(node, ElementKind.Dep)) {
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
      return validateDepSettings(settingsList);
    }
    return Report.create(PASS_THROUGH);
  },
};
