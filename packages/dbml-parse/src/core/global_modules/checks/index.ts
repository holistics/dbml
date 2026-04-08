import { isElementNode } from '@/core/utils/expression';
import { ElementKind } from '@/core/types/keywords';
import { type SyntaxNode, type ElementDeclarationNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler/index';
import type { SchemaElement } from '@/core/types/schemaJson';
import ChecksBinder from './bind';
import ChecksInterpreter from './interpret';
import { shouldInterpretNode } from '../utils';

export const checksModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    return Report.create(PASS_THROUGH);
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    return Report.create(PASS_THROUGH);
  },

  nestedSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) {
      return Report.create(PASS_THROUGH);
    }
    return new Report([]);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> { return Report.create(PASS_THROUGH); },

  bind (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new ChecksBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Checks)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new ChecksInterpreter(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).interpret();
  },
};
