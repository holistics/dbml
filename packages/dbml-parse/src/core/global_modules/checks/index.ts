import type Compiler from '@/compiler/index';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';
import {
  type ElementDeclarationNode, type SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  isElementNode,
} from '@/core/utils/expression';
import type {
  GlobalModule,
} from '../types';
import {
  shouldInterpretNode,
} from '../utils';
import ChecksBinder from './bind';
import ChecksInterpreter from './interpret';

export const checksModule: GlobalModule = {
  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new ChecksBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretNode (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new ChecksInterpreter(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).interpret();
  },
};
