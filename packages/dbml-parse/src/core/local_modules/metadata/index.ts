import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind } from '@/core/types/keywords';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { isElementNode } from '@/core/utils/validate';
import { destructureComplexVariable } from '@/core/utils/expression';
import { type LocalModule, type Settings } from '../types';
import MetadataValidator from './validate';

export const metadataModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return Report.create(PASS_THROUGH);

    return Report.create(undefined, new MetadataValidator(compiler, node).validate());
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return Report.create(PASS_THROUGH);

    if (!node.name) {
      return new Report(undefined, [
        new CompileError(CompileErrorCode.INVALID_NAME, 'A Metadata element must target an element', node),
      ]);
    }

    const nameFragments = destructureComplexVariable(node.name);
    if (!nameFragments) {
      return new Report(undefined, [
        new CompileError(
          CompileErrorCode.INVALID_NAME,
          'Invalid Metadata target name',
          node,
        ),
      ]);
    }
    return new Report(nameFragments);
  },

  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return Report.create(PASS_THROUGH);

    if (!node.alias) return new Report(undefined);

    return new Report(
      undefined,
      [
        new CompileError(CompileErrorCode.UNEXPECTED_ALIAS,
          'A Metadata shouldn\'t have an alias',
          node.alias,
        ),
      ],
    );
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return Report.create(PASS_THROUGH);

    if (!node.attributeList) return new Report({});
    return new Report(
      {},
      [
        new CompileError(
          CompileErrorCode.UNEXPECTED_SETTINGS,
          'A Metadata shouldn\'t have a setting list',
          node.attributeList,
        ),
      ],
    );
  },
};
