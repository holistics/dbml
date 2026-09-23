import { SettingName } from '@/core/types/keywords';
import { ElementDeclarationNode, FunctionApplicationNode, PrefixExpressionNode } from '@/core/types/nodes';
import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { removeSettingEdit } from '@/core/utils/setting';
import { DepMetadata } from '@/core/types/symbol/metadata';
import { SymbolKind } from '@/core/types/symbol';
import type { NodeSymbol } from '@/core/types/symbol';
import type Compiler from '../../../index';
import type { DepIdentifier, EndpointRef } from '../types';
import { lookupElementSymbol, normalizeSchema } from './index';

export interface InlineDepDefinition {
  kind: 'inline';
  op: string;
  fullStart: number;
  fullEnd: number;
}

export interface BlockDepDefinition {
  kind: 'block';
  declaration: ElementDeclarationNode;
}

export type DepDefinition = InlineDepDefinition | BlockDepDefinition;

interface ResolvedEndpoint {
  table?: NodeSymbol;
  columns: (NodeSymbol | undefined)[];
}

function resolveEndpoint (compiler: Compiler, filepath: Filepath, endpoint: EndpointRef): ResolvedEndpoint {
  const table = lookupElementSymbol(
    compiler,
    filepath,
    normalizeSchema(endpoint.schemaName),
    endpoint.tableName,
    SymbolKind.Table,
  );
  const columns = (endpoint.fieldNames ?? []).map((name) => (
    table ? compiler.lookupMembers(table, SymbolKind.Column, name) : undefined
  ));

  return { table, columns };
}

// Aliases and imports give the same element more than one symbol; its declaration is single.
function sameSymbol (left: NodeSymbol | undefined, right: NodeSymbol | undefined): boolean {
  const leftDeclaration = left?.originalSymbol.declaration;
  return !!leftDeclaration && leftDeclaration === right?.originalSymbol.declaration;
}

function endpointMatches (
  table: NodeSymbol | undefined,
  columns: NodeSymbol[],
  target: ResolvedEndpoint,
): boolean {
  if (!sameSymbol(table, target.table)) return false;
  if (columns.length !== target.columns.length) return false;
  return columns.every((column, i) => sameSymbol(column, target.columns[i]));
}

/**
 * Finds the `Dep` block or inline `[dep: …]` setting that carries the edge `target` names.
 *
 * Matching runs on resolved table and column symbols, the way {@link findRefDefinition} does.
 * The endpoints' source text cannot be compared instead: `a.b` is `schema.table` or
 * `table.field` depending on what `a` resolves to, so a mixed-level edge such as
 * `a.x -> b` is not describable without the symbol table.
 *
 * A target with no field names matches only an edge with no columns on that side.
 */
export function findDepDefinition (
  compiler: Compiler,
  filepath: Filepath,
  target: DepIdentifier,
): DepDefinition | undefined {
  const ast = compiler.parseFile(filepath).getValue().ast;
  const programSymbol = compiler.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!programSymbol) return undefined;

  const upstream = resolveEndpoint(compiler, filepath, target.upstream);
  const downstream = resolveEndpoint(compiler, filepath, target.downstream);
  if (!upstream.table || !downstream.table) return undefined;

  const source = compiler.getSource(filepath) ?? '';

  for (const meta of compiler.symbolMetadata(programSymbol)) {
    if (!(meta instanceof DepMetadata)) continue;

    const upstreamTables = meta.upstreamTables(compiler);
    const upstreamColumns = meta.upstreamColumns(compiler);
    const downstreamTables = meta.downstreamTables(compiler);
    const downstreamColumns = meta.downstreamColumns(compiler);

    const carriesEdge = upstreamTables.some((_, i) => (
      endpointMatches(upstreamTables[i], upstreamColumns[i] ?? [], upstream)
      && endpointMatches(downstreamTables[i], downstreamColumns[i] ?? [], downstream)
    ));
    if (!carriesEdge) continue;

    if (meta.declaration instanceof ElementDeclarationNode) {
      return { kind: 'block', declaration: meta.declaration };
    }

    const columnField = meta.declaration.parentOfKind(FunctionApplicationNode);
    if (!columnField) continue;
    const fullEdit = removeSettingEdit(columnField, SettingName.Dep, source);
    if (!fullEdit) continue;
    const prefix = meta.declaration.value;
    if (!(prefix instanceof PrefixExpressionNode)) continue;
    const op = prefix.op?.value;
    if (!op) continue;

    return { kind: 'inline', op, fullStart: fullEdit.start, fullEnd: fullEdit.end };
  }

  return undefined;
}
