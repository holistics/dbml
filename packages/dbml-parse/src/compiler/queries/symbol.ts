import type Compiler from '../index';
import type { Filepath } from '../projectLayout';
import type { NodeSymbol } from '@/core/analyzer/validator/symbol/symbols';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { SymbolKind, destructureIndex } from '@/core/analyzer/validator/symbol/symbolIndex';
import { generatePossibleIndexes } from '@/core/analyzer/validator/symbol/utils';
import SymbolTable from '@/core/analyzer/validator/symbol/symbolTable';

export function symbolMembers (this: Compiler, ownerSymbol: NodeSymbol) {
  if (!ownerSymbol.symbolTable) {
    return [];
  }

  return [...ownerSymbol.symbolTable.entries()].map(([index, symbol]) => ({
    ...destructureIndex(index).unwrap(),
    symbol,
  }));
}

export function symbolOfName (this: Compiler, nameStack: string[], owner: ElementDeclarationNode | ProgramNode, filepath: Filepath) {
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
    const ownerSymbol = this.resolvedSymbol(currentOwner);
    if (!ownerSymbol?.symbolTable) {
      continue;
    }

    const { symbolTable } = ownerSymbol;
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
