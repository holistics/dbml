import type Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import type {
  Database, ElementRef,
} from '@/core/types/schemaJson';
import {
  type NodeSymbol, SymbolKind,
} from '@/core/types/symbol';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  SyntaxNode,
  TupleExpressionNode,
} from '@/core/types/nodes';
import {
  destructureMemberAccessExpression,
} from '@/core/utils/expression';

// Resolve a ref operand to a sorted array of original column symbol IDs
export function getColumnSymbolIds (compiler: Compiler, node: SyntaxNode): string[] | undefined {
  const fragments = destructureMemberAccessExpression(node);
  if (!fragments || fragments.length === 0) return undefined;

  const lastFragment = fragments[fragments.length - 1];

  // Composite ref: table.(col1, col2)
  if (lastFragment instanceof TupleExpressionNode) {
    const ids: string[] = [];
    for (const elem of lastFragment.elementList) {
      const sym = compiler.nodeReferee(elem).getFiltered(UNHANDLED);
      if (!sym) return undefined;
      ids.push(sym.originalSymbol.intern());
    }
    return ids.sort();
  }

  // Resolve the last fragment (the column) to its original symbol
  const last = fragments[fragments.length - 1];
  if (!last || last instanceof TupleExpressionNode) return undefined;
  const sym = compiler.nodeReferee(last).getFiltered(UNHANDLED);
  if (!sym) return undefined;
  return [
    sym.originalSymbol.intern(),
  ];
}

function isSameEndpoint (left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((id, i) => id === right[i]);
}

// Canonical ref ID: sorted pair of endpoint IDs so A>B and B>A produce the same key
function getRefId (left: string[], right: string[]): string {
  const leftStr = left.join(',');
  const rightStr = right.join(',');
  return leftStr < rightStr ? `${leftStr}-${rightStr}` : `${rightStr}-${leftStr}`;
}

// Check a ref's endpoints for same-endpoint and duplicate/circular errors
// `seenRefIds` is shared across all refs to detect cross-ref duplicates
export function checkRefEndpoints (
  leftIds: string[],
  rightIds: string[],
  errorNode: SyntaxNode,
  seenRefIds: Map<string, SyntaxNode>,
): CompileError[] {
  if (isSameEndpoint(leftIds, rightIds)) {
    return [
      new CompileError(CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same', errorNode),
    ];
  }

  const refId = getRefId(leftIds, rightIds);
  const existing = seenRefIds.get(refId);
  if (existing) {
    return [
      new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', errorNode),
      new CompileError(CompileErrorCode.CIRCULAR_REF, 'References with same endpoints exist', existing),
    ];
  }
  seenRefIds.set(refId, errorNode);
  return [];
}

export function pushExternal (db: Database, member: NodeSymbol, ref: ElementRef): void {
  if (member.isKind(SymbolKind.Table)) db.externals.tables.push(ref);
  else if (member.isKind(SymbolKind.Enum)) db.externals.enums.push(ref);
  else if (member.isKind(SymbolKind.TableGroup)) db.externals.tableGroups.push(ref);
  else if (member.isKind(SymbolKind.TablePartial)) db.externals.tablePartials.push(ref);
  else if (member.isKind(SymbolKind.StickyNote)) db.externals.notes.push(ref);
}
