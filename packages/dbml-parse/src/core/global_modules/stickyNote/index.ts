import type Compiler from '@/compiler/index';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  PASS_THROUGH, type PassThrough,
} from '@/core/types/module';
import {
  type ElementDeclarationNode, ProgramNode, type SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Note,
} from '@/core/types/schemaJson';
import {
  NodeSymbol, SymbolKind,
} from '@/core/types/symbol';
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
import NoteBinder from './bind';
import {
  StickyNoteInterpreter,
} from './interpret';

export const noteModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note) || !(node.parentNode instanceof ProgramNode)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report(compiler.symbolFactory.create(NodeSymbol, {
      kind: SymbolKind.Note,
      declaration: node,
    }, node.filepath));
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Note)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report([]);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new NoteBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretNode (compiler: Compiler, node: SyntaxNode): Report<Note | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new StickyNoteInterpreter(compiler, node).interpret();
  },
};
