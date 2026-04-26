import Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, PassThrough,
} from '@/core/types/module';
import {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  isElementNode,
} from '@/core/utils/expression';
import {
  Settings,
} from '@/core/utils/validate';
import {
  LocalModule,
} from '../types';
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
