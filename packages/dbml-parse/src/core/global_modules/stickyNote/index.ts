import { isElementNode } from '@/core/utils/expression';
import { ElementKind } from '@/core/types/keywords';
import type { SyntaxNode, ElementDeclarationNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler/index';
import type { Note } from '@/core/types/schemaJson';
import NoteBinder from './bind';
import { StickyNoteInterpreter } from './interpret';

export const noteModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report(compiler.symbolFactory.create(NodeSymbol, {
      kind: SymbolKind.Note,
      declaration: node,
    }));
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Note)) {
      return Report.create(PASS_THROUGH);
    }

    return new Report([]);
  },

  nestedSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) {
      return Report.create(PASS_THROUGH);
    }
    return new Report([]);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> { return Report.create(PASS_THROUGH); },

  bind (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);
    return Report.create(
      undefined,
      new NoteBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<Note | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Note)) return Report.create(PASS_THROUGH);
    return new StickyNoteInterpreter(compiler, node).interpret();
  },
};
