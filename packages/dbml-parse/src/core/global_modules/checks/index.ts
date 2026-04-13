import {
  isElementNode,
} from '@/core/utils/expression';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  type SyntaxNode, type ElementDeclarationNode,
} from '@/core/types/nodes';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import type {
  GlobalModule,
} from '../types';
import {
  PASS_THROUGH, type PassThrough,
} from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import ChecksBinder from './bind';
import ChecksInterpreter from './interpret';
import {
  shouldInterpretNode,
} from '../utils';

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
