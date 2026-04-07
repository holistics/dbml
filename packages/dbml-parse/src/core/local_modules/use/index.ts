import { destructureComplexVariable, extractVariableFromExpression, isUseSpecifier } from '@/core/utils/expression';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  SyntaxNode,
  UseDeclarationNode,
} from '@/core/parser/nodes';
import type { LocalModule, Settings } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler';
import UseDeclarationValidator from './validate';
import { ImportKind } from '@/core/types';
import { isValidAlias } from '@/core/utils/validate';

// Handle use declaration, use specifier name, use specifier list
export const useModule: LocalModule = {
  validate (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (node instanceof UseDeclarationNode) {
      return Report.create(undefined, new UseDeclarationValidator(compiler, node).validate());
    }
    return Report.create(PASS_THROUGH);
  },

  fullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isUseSpecifier(node)) return Report.create(PASS_THROUGH); // Only use specifiers can have names

    const name = destructureComplexVariable(node.name);

    if (!name || name.length === 0) return Report.create(undefined, [
      new CompileError(
        CompileErrorCode.INVALID_NAME,
        'Use specifiers must have a valid name (simple name or schema-qualified name)',
        node,
      ),
    ]);

    if (node.isKind(ImportKind.TableGroup) && name.length > 1) {
      return Report.create(
        name,
        [
          new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A TableGroup name must be a simple name', node),
        ],
      );
    }

    if (node.isKind(ImportKind.Note) && name.length > 1) {
      return Report.create(
        name,
        [
          new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A Sticky note name must be a simple name', node),
        ],
      );
    }

    if (node.isKind(ImportKind.TableGroup) && name.length > 1) {
      return Report.create(
        name,
        [
          new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A TableGroup name must be a simple name', node),
        ],
      );
    }

    return new Report(name);
  },

  alias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isUseSpecifier(node)) return Report.create(PASS_THROUGH); // Only use specifiers can have aliases
    if (!node.alias) return new Report(undefined);
    if (!isValidAlias(node.alias)) {
      return new Report(undefined, [new CompileError(CompileErrorCode.INVALID_ALIAS, 'Use aliases can only contains alphanumeric and underscore unless surrounded by double quotes', node.alias)]);
    }
    return new Report(extractVariableFromExpression(node.alias));
  },

  settings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!(node instanceof UseDeclarationNode)) return Report.create(PASS_THROUGH);
    return Report.create({});
  },
};
