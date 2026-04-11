import { ElementKind } from '@/core/types/keywords';
import { isElementNode, isElementFieldNode, destructureComplexVariable } from '@/core/utils/expression';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { type LocalModule } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import {
  SyntaxNode,
} from '@/core/types/nodes';
import { isSimpleName, Settings } from '@/core/utils/validate';
import Report from '@/core/types/report';
import type Compiler from '@/compiler';
import TableGroupValidator, { validateSettingList } from './validate';

export const tableGroupModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      return Report.create(undefined, new TableGroupValidator(compiler, node).validate());
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      if (!node.name) {
        return new Report(undefined, [new CompileError(
          CompileErrorCode.NAME_NOT_FOUND,
          'A TableGroup must have a name',
          node,
        )]);
      }
      if (!isSimpleName(node.name)) {
        return new Report(undefined, [new CompileError(
          CompileErrorCode.INVALID_NAME,
          'A TableGroup name must be a single identifier',
          node.name,
        )]);
      }
      return new Report(destructureComplexVariable(node.name));
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      return new Report(destructureComplexVariable(node.callee));
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      if (node.alias) {
        return new Report(undefined, [new CompileError(
          CompileErrorCode.UNEXPECTED_ALIAS,
          'A TableGroup shouldn\'t have an alias',
          node.alias,
        )]);
      }
      return new Report(undefined);
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      return validateSettingList(node.attributeList);
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      return new Report({});
    }
    return Report.create(PASS_THROUGH);
  },
};
