import { isElementNode } from '@/core/utils/expression';
import { ElementKind } from '@/core/types/keywords';
import { type SyntaxNode, type ElementDeclarationNode, ProgramNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import type { Note } from '@/core/types/schemaJson';
import NoteBinder from './bind';
import { StickyNoteInterpreter } from './interpret';
import { shouldInterpretNode } from '../utils';

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
