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
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  destructureComplexVariable, isElementFieldNode, isElementNode,
} from '@/core/utils/expression';
import {
  Settings, isSimpleName,
} from '@/core/utils/validate';
import {
  type LocalModule,
} from '../types';
import TableGroupValidator, {
  validateSettingList,
} from './validate';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';

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
        return new Report(undefined, [
          new CompileError(
            CompileErrorCode.NAME_NOT_FOUND,
            'A TableGroup must have a name',
            node,
          ),
        ]);
      }
      if (!isSimpleName(node.name)) {
        return new Report(undefined, [
          new CompileError(
            CompileErrorCode.INVALID_NAME,
            'A TableGroup name must be a single identifier',
            node.name,
          ),
        ]);
      }
      return new Report(destructureComplexVariable(node.name));
    }
    if (isElementFieldNode(node, ElementKind.TableGroup)) {
      const names = destructureComplexVariable(node.callee);
      if (names?.length === 1) names.unshift(DEFAULT_SCHEMA_NAME);

      return new Report(names);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TableGroup)) {
      if (node.alias) {
        return new Report(undefined, [
          new CompileError(
            CompileErrorCode.UNEXPECTED_ALIAS,
            'A TableGroup shouldn\'t have an alias',
            node.alias,
          ),
        ]);
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
