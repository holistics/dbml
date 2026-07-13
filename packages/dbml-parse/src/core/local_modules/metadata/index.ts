import type Compiler from '@/compiler';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { isElementNode } from '@/core/utils/validate';
import { ElementKind } from '@/core/types';
import { type LocalModule, type Settings } from '../types';
import MetadataValidator from './validate';

export const metadataModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return new Report(PASS_THROUGH);

    return new Report(undefined, new MetadataValidator(compiler, node).validate());
  },

  /** A Metadata element does not have a name */
  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return new Report(PASS_THROUGH);

    return new Report(undefined);
  },

  /** A Metadata element does not have an alias */
  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return new Report(PASS_THROUGH);

    return new Report(undefined);
  },

  /** A Metadata element does not have settings */
  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Metadata)) return new Report(PASS_THROUGH);

    return new Report({});
  },
};
