import { ElementKind } from '@/core/types/keywords';
import { ElementDeclarationNode } from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { PASS_THROUGH, type PassThrough } from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import type { SchemaElement } from '@/core/types/schemaJson';
import { isElementNode } from '@/core/utils/expression';
import { shouldInterpretNode } from '../utils';
import { DiagramViewInterpreter } from './interpret';

export const diagramViewModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.DiagramView)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.DiagramView,
        declaration: node,
      }));
    }
    return Report.create(PASS_THROUGH);
  },

  bind (_compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.DiagramView)) return Report.create(PASS_THROUGH);
    // No cross-reference binding needed for DiagramView currently
    return Report.create(undefined);
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.DiagramView)) return Report.create(PASS_THROUGH);
    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new DiagramViewInterpreter(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).interpret();
  },
};
