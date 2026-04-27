import type Compiler from '@/compiler/index';
import {
  ElementKind,
} from '@/core/types/keywords';
import type {
  IndexMetadata, SymbolMetadata,
} from '@/core/types/metadata';
import {
  MetadataKind,
} from '@/core/types/metadata';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  CallExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  NodeSymbol, SymbolKind,
} from '@/core/types/symbol';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  SettingName,
} from '@/core/types/keywords';
import {
  destructureIndexNode, extractVarNameFromPrimaryVariable,
  getBody, isElementNode, isExpressionAVariableNode, isInsideSettingList,
} from '@/core/utils/expression';
import type {
  GlobalModule,
} from '../types';
import IndexesBinder from './bind';
import IndexesInterpreter from './interpret';

export const indexesModule: GlobalModule = {
  emitMetadata (compiler: Compiler, node: SyntaxNode): Report<SymbolMetadata[]> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Indexes)) return Report.create(PASS_THROUGH);

    const tableNode = node.parent;
    if (!tableNode || (!isElementNode(tableNode, ElementKind.Table) && !isElementNode(tableNode, ElementKind.TablePartial))) return Report.create(PASS_THROUGH);

    const tableSymbol = compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
    if (!tableSymbol) return Report.create(PASS_THROUGH);

    const body = getBody(node as ElementDeclarationNode);
    const results: IndexMetadata[] = [];

    for (const field of body) {
      if (!(field instanceof FunctionApplicationNode)) continue;

      const columns: IndexMetadata['columns'] = [];
      const args: SyntaxNode[] = [
        field.callee!,
        ...field.args,
      ];
      if (args.at(-1) instanceof ListExpressionNode) args.pop();

      const settingsMap = compiler.nodeSettings(field).getFiltered(UNHANDLED);
      const pk = !!settingsMap?.[SettingName.PK]?.length;
      const unique = !!settingsMap?.[SettingName.Unique]?.length;

      const flatArgs = args.flatMap((arg) => {
        if (!(arg instanceof CallExpressionNode)) return arg;
        const fragments: SyntaxNode[] = [];
        let current: SyntaxNode = arg;
        while (current instanceof CallExpressionNode) {
          if ((current as CallExpressionNode).argumentList) fragments.push((current as CallExpressionNode).argumentList!);
          if (!(current as CallExpressionNode).callee) break;
          current = (current as CallExpressionNode).callee!;
        }
        fragments.push(current);
        return fragments;
      });

      for (const arg of flatArgs) {
        const result = destructureIndexNode(arg);
        if (!result) continue;
        for (const s of result.functional) {
          columns.push({
            value: s.value?.value ?? '',
            type: 'expression',
          });
        }
        for (const s of result.nonFunctional) {
          columns.push({
            value: extractVarNameFromPrimaryVariable(s) ?? '',
            type: 'column',
          });
        }
      }

      results.push({
        kind: MetadataKind.Index,
        target: tableSymbol,
        columns,
        pk,
        unique,
        declaration: node,
      });
    }

    return Report.create(results);
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
    if (!tableNode || !isElementNode(tableNode, ElementKind.Table)) return Report.create(PASS_THROUGH);
    const tableSymbol = compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
    if (!tableSymbol) return new Report(undefined);

    const varName = isExpressionAVariableNode(node) ? (node.expression.variable?.value ?? '') : '';
    return compiler.lookupMembers(tableSymbol, SymbolKind.Column, varName);
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Indexes)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new IndexesBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretMetadata (compiler: Compiler, metadata: SymbolMetadata): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (metadata.kind !== MetadataKind.Index) return Report.create(PASS_THROUGH);
    if (!(metadata.declaration instanceof ElementDeclarationNode)) return Report.create(undefined);

    return new IndexesInterpreter(compiler, metadata.declaration).interpret();
  },
};
