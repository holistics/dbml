import { UNHANDLED } from '@/core/types/module';
import { ElementDeclarationNode } from '@/core/types/nodes';
import { type NodeSymbol, type ProgramSymbol, SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';

/**
  * Whether `symbol` is visible from `program`.
  * - Column: visible when its table is (a column is not a direct schema member)
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

  return program.inNestedSchema(this, target);
}
