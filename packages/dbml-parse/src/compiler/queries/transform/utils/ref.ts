import { SettingName } from '@/core/types/keywords';
import { AttributeNode, ElementDeclarationNode, FunctionApplicationNode } from '@/core/types/nodes';
import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { removeSettingEdit } from '@/core/utils/setting';
import { getBody } from '@/core/utils/expression';
import { RefMetadata } from '@/core/types/symbol/metadata';
import type { TableSymbol, ColumnSymbol } from '@/core/types/symbol';
import type Compiler from '../../../index';
import type { EndpointRef, RefIdentifier } from '../types';

export interface InlineRef {
  kind: 'inline';
  op: string;
  fullStart: number;
  fullEnd: number;
}

export interface StandaloneRef {
  kind: 'standalone';
  node: FunctionApplicationNode;
}

export function findRefDefinition (compiler: Compiler, filepath: Filepath, target: RefIdentifier): InlineRef | StandaloneRef | undefined {
  const ast = compiler.parseFile(filepath).getValue().ast;
  const programSymbol = compiler.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!programSymbol) return undefined;

  const source = compiler.getSource(filepath) ?? '';

  for (const meta of compiler.symbolMetadata(programSymbol)) {
    if (!(meta instanceof RefMetadata)) continue;
    if (!refMetadataMatches(compiler, meta, target)) continue;

    if (meta.declaration instanceof AttributeNode) {
      const op = meta.op(compiler);
      if (!op) continue;
      const columnField = meta.declaration.parentOfKind(FunctionApplicationNode);
      if (!columnField) continue;
      const fullEdit = removeSettingEdit(columnField, SettingName.Ref, source);
      if (!fullEdit) continue;
      return { kind: 'inline', op, fullStart: fullEdit.start, fullEnd: fullEdit.end };
    }

    if (meta.declaration instanceof ElementDeclarationNode) {
      const edgeNode = getBody(meta.declaration)[0];
      if (edgeNode instanceof FunctionApplicationNode) return { kind: 'standalone', node: edgeNode };
    }
  }

  return undefined;
}

function endpointMatches (table: TableSymbol | undefined, columns: ColumnSymbol[], ep: EndpointRef): boolean {
  if (!table?.name || table.name !== ep.tableName) return false;
  const fields = ep.fieldNames ?? [];
  if (fields.length === 0) return true;
  if (columns.length !== fields.length) return false;
  return columns.every((col, i) => col.name === fields[i]);
}

function refMetadataMatches (compiler: Compiler, meta: RefMetadata, target: RefIdentifier): boolean {
  const leftTable = meta.leftTable(compiler);
  const leftColumns = meta.leftColumns(compiler);
  const rightTable = meta.rightTable(compiler);
  const rightColumns = meta.rightColumns(compiler);

  const [
    ep0,
    ep1,
  ] = target.endpoints;

  return (endpointMatches(leftTable, leftColumns, ep0) && endpointMatches(rightTable, rightColumns, ep1))
    || (endpointMatches(leftTable, leftColumns, ep1) && endpointMatches(rightTable, rightColumns, ep0));
}
