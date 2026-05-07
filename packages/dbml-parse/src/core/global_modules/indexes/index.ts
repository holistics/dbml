import type Compiler from '@/compiler/index';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  IndexesMetadata, MetadataKind,
} from '@/core/types/symbol/metadata';
import type {
  NodeMetadata,
} from '@/core/types/symbol/metadata';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  ElementDeclarationNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  type NodeSymbol,
  SymbolKind,
} from '@/core/types/symbol';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import type {
  GlobalModule,
} from '../types';
import IndexesBinder from './bind';
import IndexesInterpreter from './interpret';
import {
  isElementNode, isExpressionAVariableNode, isInsideSettingList,
} from '@/core/utils/validate';
import {
  CompileError, CompileErrorCode,
} from '@/core/types';

export const indexesModule: GlobalModule = {
  nodeMetadata (compiler: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Indexes)) return Report.create(PASS_THROUGH);

    const tableNode = node.parent;
    if (!tableNode || (!isElementNode(tableNode, ElementKind.Table) && !isElementNode(tableNode, ElementKind.TablePartial))) return Report.create(PASS_THROUGH);

    return Report.create(new IndexesMetadata(node));
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node)) {
      return Report.create(PASS_THROUGH);
    }

    // Skip variables inside index settings (e.g. [type: btree])
    if (isInsideSettingList(node)) return Report.create(PASS_THROUGH);

    let indexesNode: SyntaxNode | undefined = node;
    while (indexesNode && !isElementNode(indexesNode, ElementKind.Indexes)) {
      indexesNode = indexesNode.parent;
    }
    if (!indexesNode) return Report.create(PASS_THROUGH);

    const tableNode = indexesNode.parent;
    if (!tableNode || (!isElementNode(tableNode, ElementKind.Table) && !isElementNode(tableNode, ElementKind.TablePartial))) return Report.create(PASS_THROUGH);
    const tableSymbol = compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
    if (!tableSymbol) return new Report(undefined);

    const varName = isExpressionAVariableNode(node) ? (node.expression.variable?.value ?? '') : '';
    const symbol = compiler.lookupMembers(tableSymbol, SymbolKind.Column, varName);
    if (symbol) {
      return Report.create(symbol);
    }

    const containerKind = isElementNode(tableNode, ElementKind.TablePartial) ? 'TablePartial' : 'Table';
    return new Report(undefined, [
      new CompileError(CompileErrorCode.BINDING_ERROR, `Column '${varName}' does not exist in ${containerKind} 'public.${tableSymbol.name}'`, node),
    ]);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Indexes)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new IndexesBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretMetadata (compiler: Compiler, metadata: NodeMetadata): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (metadata.kind !== MetadataKind.Indexes) return Report.create(PASS_THROUGH);
    if (!(metadata.declaration instanceof ElementDeclarationNode)) return Report.create(undefined);

    return new IndexesInterpreter(compiler, metadata.declaration).interpret();
  },
};
