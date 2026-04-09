import Compiler from '@/compiler';
import { PASS_THROUGH, PassThrough } from '@/constants';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementKind } from '@/core/types/keywords';
import { SyntaxNode } from '@/core/parser/nodes';
import Report from '@/core/report';
import { isElementNode } from '@/core/utils/expression';
import { LocalModule } from '../types';
import { Settings } from '@/core/utils/validate';
import ChecksValidator from './validate';

export const checksModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);
    const validator = new ChecksValidator(compiler, node);
    return Report.create(undefined, validator.validate());
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);

    if (!node.name) return new Report(undefined);

    return new Report(
      undefined, [
        new CompileError(
          CompileErrorCode.UNEXPECTED_NAME,
          'A Checks shouldn\'t have a name',
          node.name,
        ),
      ],
    );
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);
    if (!node.alias) return new Report(undefined);
    return new Report(
      undefined,
      [
        new CompileError(CompileErrorCode.UNEXPECTED_ALIAS,
          'A Checks shouldn\'t have an alias',
          node.alias,
        ),
      ],
    );
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);

    if (!node.attributeList) return new Report({});
    return new Report(
      {},
      [
        new CompileError(
          CompileErrorCode.UNEXPECTED_SETTINGS,
          'A Checks shouldn\'t have a setting list',
          node.attributeList,
        ),
      ],
    );
  },
};
