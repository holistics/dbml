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
import RefValidator, { validateFieldSettings } from './validate';

export const refModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Ref)) {
      return Report.create(undefined, new RefValidator(compiler, node).validate());
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Ref)) {
      if (!node.name) return new Report(undefined);
      if (!isSimpleName(node.name)) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.INVALID_NAME, 'A Ref\'s name is optional or must be an identifier or a quoted identifer', node.name),
        ]);
      }
      return new Report(destructureComplexVariable(node.name));
    }
    if (isElementFieldNode(node, ElementKind.Ref)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Ref)) {
      if (node.alias) {
        return new Report(undefined, [
          new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Ref shouldn\'t have an alias', node.alias),
        ]);
      }
      return new Report(undefined);
    }
    if (isElementFieldNode(node, ElementKind.Ref)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Ref)) {
      if (node.attributeList) {
        return new Report({}, [
          new CompileError(
            CompileErrorCode.UNEXPECTED_SETTINGS,
            'A Ref shouldn\'t have a setting list',
            node.attributeList,
          ),
        ]);
      }
      return new Report({});
    }
    if (isElementFieldNode(node, ElementKind.Ref)) {
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

      return validateFieldSettings(settingsList);
    }
    return Report.create(PASS_THROUGH);
  },
};
