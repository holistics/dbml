import {
  isElementNode, isElementFieldNode, isExpressionAVariableNode, isInsideSettingList,
} from '@/core/utils/expression';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  ElementDeclarationNode, PrimaryExpressionNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  NodeSymbol, SymbolKind,
} from '@/core/types/symbol';
import type {
  GlobalModule,
} from '../types';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  getNodeMemberSymbols, lookupMember, shouldInterpretNode,
} from '../utils';
import IndexesBinder from './bind';
import IndexesInterpreter from './interpret';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';

export const indexesModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Indexes)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.Indexes,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.Indexes)) {
      if (node instanceof PrimaryExpressionNode) {
        return new Report(compiler.symbolFactory.create(NodeSymbol, {
          kind: SymbolKind.IndexesField,
          declaration: node,
        }, node.filepath));
      }
      return Report.create(PASS_THROUGH);
    }
    return Report.create(PASS_THROUGH);
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (symbol.isKind(SymbolKind.Indexes)) {
      if (!symbol.declaration) {
        return new Report([]);
      }
      const symbols = getNodeMemberSymbols(compiler, symbol.declaration);
      if (symbols.hasValue(UNHANDLED)) {
        return new Report([]);
      }
      return symbols as Report<NodeSymbol[]>;
    }
    if (symbol.isKind(SymbolKind.IndexesField)) {
      return new Report([]);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node)) {
      return Report.create(PASS_THROUGH);
    }

    // Skip variables inside index settings (e.g. [type: btree])
    if (isInsideSettingList(node)) return Report.create(PASS_THROUGH);

    let ancestor: SyntaxNode | undefined = node;
    while (ancestor && !(ancestor instanceof ElementDeclarationNode && ancestor.isKind(ElementKind.Indexes))) ancestor = ancestor.parent;
    if (!ancestor) return Report.create(PASS_THROUGH);

    const tableNode = ancestor.parent;
    if (!tableNode || !isElementNode(tableNode, ElementKind.Table)) return Report.create(PASS_THROUGH);
    const tableSymbol = compiler.nodeSymbol(tableNode);
    if (tableSymbol.hasValue(UNHANDLED)) return new Report(undefined);

    const varName = isExpressionAVariableNode(node) ? (node.expression.variable?.value ?? '') : '';
    return lookupMember(compiler, tableSymbol.getValue(), varName, {
      kinds: [SymbolKind.Column],
    });
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Indexes)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new IndexesBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretNode (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Indexes)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new IndexesInterpreter(compiler, node).interpret();
  },
};
