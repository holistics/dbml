import type Compiler from '../index';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { SymbolKind, destructureIndex } from '@/core/analyzer/symbol/symbolIndex';
import { generatePossibleIndexes } from '@/core/analyzer/symbol/utils';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';

export function symbolMembers (this: Compiler, ownerSymbol: NodeSymbol) {
  if (!ownerSymbol.symbolTable) {
    return [];
  }

  return [...ownerSymbol.symbolTable.entries()].map(([index, symbol]) => ({
    ...destructureIndex(index).unwrap(),
    symbol,
  }));
}

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
    if (!currentOwner.symbol?.symbolTable) {
      continue;
    }

    const { symbolTable } = currentOwner.symbol;
    let currentPossibleSymbolTables: SymbolTable[] = [symbolTable];
    let currentPossibleSymbols: { symbol: NodeSymbol; kind: SymbolKind; name: string }[] = [];

    for (const name of nameStack) {
      currentPossibleSymbols = currentPossibleSymbolTables.flatMap((st) =>
        generatePossibleIndexes(name).flatMap((index) => {
          const symbol = st.get(index);
          const desRes = destructureIndex(index).unwrap_or(undefined);

          return !symbol || !desRes ? [] : { ...desRes, symbol };
        }),
      );
      currentPossibleSymbolTables = currentPossibleSymbols.flatMap((e) =>
        e.symbol.symbolTable ? e.symbol.symbolTable : [],
      );
    }

    res.push(...currentPossibleSymbols);
  }

  return res;
}

export function symbolOfNameToKey (nameStack: string[], owner: { id: number }): string {
  return `${nameStack.join('.')}@${owner.id}`;
}
