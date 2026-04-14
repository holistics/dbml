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
  destructureComplexVariable, extractVariableFromExpression, isElementFieldNode, isElementNode,
} from '@/core/utils/expression';
import {
  Settings, isSimpleName,
} from '@/core/utils/validate';
import type {
  LocalModule,
} from '../types';
import TablePartialValidator, {
  validateFieldSetting, validateTablePartialSettings,
} from './validate';

export const tablePartialModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TablePartial)) {
      return Report.create(undefined, new TablePartialValidator(compiler, node).validate());
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TablePartial)) {
      if (!node.name) {
        return new Report(undefined, [
          new CompileError(
            CompileErrorCode.NAME_NOT_FOUND,
            'A TablePartial must have a name',
            node,
          ),
        ]);
      }
      if (!isSimpleName(node.name)) {
        return new Report(undefined, [
          new CompileError(
            CompileErrorCode.INVALID_NAME,
            'A TablePartial name must be an identifier or a quoted identifer',
            node.name,
          ),
        ]);
      }
      return new Report(destructureComplexVariable(node.name));
    }
    if (isElementFieldNode(node, ElementKind.TablePartial)) {
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
    if (isElementNode(node, ElementKind.TablePartial)) {
      if (node.alias) {
        return new Report(undefined, [
          new CompileError(
            CompileErrorCode.UNEXPECTED_ALIAS,
            'A TablePartial shouldn\'t have an alias',
            node.alias,
          ),
        ]);
      }
      return new Report(extractVariableFromExpression(node.alias));
    }
    if (isElementFieldNode(node, ElementKind.TablePartial)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.TablePartial)) {
      return validateTablePartialSettings(node.attributeList);
    }
    if (isElementFieldNode(node, ElementKind.TablePartial)) {
      const remains = node.args.slice(1);
      return validateFieldSetting(remains);
    }
    return Report.create(PASS_THROUGH);
  },
};
