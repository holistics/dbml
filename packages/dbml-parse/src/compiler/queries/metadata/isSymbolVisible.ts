import { UNHANDLED } from '@/core/types/module';
import { ElementDeclarationNode } from '@/core/types/nodes';
import { type NodeSymbol, type ProgramSymbol, SymbolKind } from '@/core/types/symbol';
import { RefMetadata } from '@/core/types/symbol/metadata';
import type Compiler from '../../index';

/**
  * Whether `symbol` is visible from `program`.
  * - Column: visible when its table is (a column is not a direct schema member)
  * - Ref: refs are not imported via `use`, a ref is visible when it shows up in the program's output,
  *   i.e. the program reaches the ref's file and sees both endpoint tables (RefMetadata.owners)
  * - otherwise: the symbol sits in the program's schemas, directly or through `use`
  */
export function isSymbolVisible (this: Compiler, program: ProgramSymbol, symbol: NodeSymbol): boolean {
  const target = symbol.originalSymbol;

  if (target.isKind(SymbolKind.Column)) {
    const tableNode = target.declaration?.parentOfKind(ElementDeclarationNode);
    if (!tableNode) return false;

    const tableSymbol = this.nodeSymbol(tableNode).getFiltered(UNHANDLED)?.originalSymbol;
    return !!tableSymbol && this.isSymbolVisible(program, tableSymbol);
  }

  if (target.isKind(SymbolKind.Ref)) {
    const refMetadata = target.declaration
      ? this.nodeMetadata(target.declaration).getFiltered(UNHANDLED)
      : undefined;
    return refMetadata instanceof RefMetadata && refMetadata.owners(this).includes(program);
  }

  return program.inNestedSchema(this, target);
}
