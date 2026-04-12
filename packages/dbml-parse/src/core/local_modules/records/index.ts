import {
  isElementNode, isElementFieldNode,
} from '@/core/utils/expression';
import {
  destructureComplexVariable, extractVariableFromExpression, extractQuotedStringToken,
} from '@/core/utils/expression';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  PASS_THROUGH, UNHANDLED, type PassThrough,
} from '@/constants';
import {
  CallExpressionNode, ElementDeclarationNode, ProgramNode, SyntaxNode, TupleExpressionNode,
} from '@/core/types/nodes';
import { ElementKind } from '@/core/types/keywords';
import {
  type LocalModule, type Settings,
} from '../types';
import { isValidName } from '@/core/utils/validate';
import { isTupleOfVariables } from '@/core/utils/expression';
import Report from '@/core/types/report';
import type Compiler from '@/compiler';
import RecordsValidator from './validate';

export const recordsModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Records)) {
      return Report.create(undefined, new RecordsValidator(compiler, node).validate());
    }
    if (isElementFieldNode(node, ElementKind.Records)) {
      return Report.create(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Records)) {
      const parent = node.parent;
      const isTopLevel = parent instanceof ProgramNode;

      if (isTopLevel) {
        // Top-level: must have name in form table(col1, col2, ...)
        if (!(node.name instanceof CallExpressionNode)) {
          return new Report(undefined, [
            new CompileError(
              CompileErrorCode.INVALID_RECORDS_NAME,
              'Records at top-level must have a name in the form of table(col1, col2, ...) or schema.table(col1, col2, ...)',
              node.name || node.type || node,
            ),
          ]);
        }

        const errs: CompileError[] = [];
        if (!node.name.callee || !isValidName(node.name.callee)) {
          errs.push(new CompileError(
            CompileErrorCode.INVALID_RECORDS_NAME,
            'Records table reference must be a valid table name',
            node.name.callee || node.name,
          ));
        }
        if (!node.name.argumentList || !isTupleOfVariables(node.name.argumentList)) {
          errs.push(new CompileError(
            CompileErrorCode.INVALID_RECORDS_NAME,
            'Records column list must be simple column names',
            node.name.argumentList || node.name,
          ));
        }

        // Fullname: destructure the callee (table name) of the call expression
        // e.g. records auth.users(id, name) → ['auth', 'users']
        return new Report(destructureComplexVariable(node.name.callee), errs);
      } else {
        // Inside a table: optional column list only
        if (node.name && !isTupleOfVariables(node.name)) {
          return new Report(undefined, [
            new CompileError(
              CompileErrorCode.INVALID_RECORDS_NAME,
              'Records inside a Table can only have a column list like (col1, col2, ...)',
              node.name,
            ),
          ]);
        }
        return new Report(destructureComplexVariable(node.name));
      }
    }
    if (isElementFieldNode(node, ElementKind.Records)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Records)) {
      if (node.alias) {
        return new Report(undefined, [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'Records cannot have an alias', node.alias)]);
      }
      return new Report(undefined);
    }
    if (isElementFieldNode(node, ElementKind.Records)) {
      return new Report(undefined);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Records)) {
      if (node.attributeList) {
        return new Report({}, [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'Records cannot have a setting list', node.attributeList)]);
      }
      return new Report({});
    }
    if (isElementFieldNode(node, ElementKind.Records)) {
      return new Report({});
    }
    return Report.create(PASS_THROUGH);
  },
};
