import type Compiler from '../../index';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import { UNHANDLED } from '@/constants';

export function symbolOfName (this: Compiler, nameStack: string[], owner: ElementDeclarationNode | ProgramNode) {
  if (nameStack.length === 0) {
    return [];
  }

  const res: { symbol: NodeSymbol; kind: SymbolKind; name: string }[] = [];

  for (
    let currentOwner: ElementDeclarationNode | ProgramNode | undefined = owner;
    currentOwner;
    currentOwner = currentOwner instanceof ElementDeclarationNode
      ? currentOwner.parent
      : undefined
  ) {
    const symResult = this.nodeSymbol(currentOwner);
    if (symResult.hasValue(UNHANDLED)) {
      continue;
    }

    const ownerSymbol = symResult.getValue();
    const membersResult = this.symbolMembers(ownerSymbol);
    if (membersResult.hasValue(UNHANDLED)) {
      continue;
    }

    let currentPossibleSymbols: NodeSymbol[] = membersResult.getValue();
    let matchedSymbols: { symbol: NodeSymbol; kind: SymbolKind; name: string }[] = [];

    for (const name of nameStack) {
      matchedSymbols = currentPossibleSymbols
        .filter((s) => this.symbolName(s) === name)
        .map((symbol) => ({
          symbol,
          kind: symbol.kind,
          name,
        }));

      // Descend into matched symbols' children for the next name segment
      currentPossibleSymbols = matchedSymbols.flatMap((entry) => {
        const childResult = this.symbolMembers(entry.symbol);
        if (childResult.hasValue(UNHANDLED)) return [];
        return childResult.getValue();
      });
    }

    res.push(...matchedSymbols);
  }

  return res;
}
