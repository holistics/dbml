import type Compiler from '../../index';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { SymbolKind, destructureIndex } from '@/core/analyzer/symbol/symbolIndex';
import { generatePossibleIndexes } from '@/core/analyzer/symbol/utils';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';

export interface OfNameArg {
  nameStack: string[];
  owner: ElementDeclarationNode | ProgramNode;
}

export type OfNameResult = readonly Readonly<{
  symbol: NodeSymbol;
  kind: SymbolKind;
  name: string;
}>[];

export function ofName (this: Compiler, arg: OfNameArg): OfNameResult {
  const { nameStack, owner = this.parse.ast() } = arg;

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

export function ofNameToKey (arg: OfNameArg): string {
  return `${arg.nameStack.join('.')}@${arg.owner.id}`;
}
