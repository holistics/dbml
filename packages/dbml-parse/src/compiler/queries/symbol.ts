import type Compiler from '../index';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/validator/symbol/symbols';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { SymbolKind, destructureIndex } from '@/core/validator/symbol/symbolIndex';
import { generatePossibleIndexes } from '@/core/validator/symbol/utils';
import SymbolTable from '@/core/validator/symbol/symbolTable';

export function nodeSymbol (this: Compiler, node: SyntaxNode): NodeSymbol | undefined {
  // TODO: for multi-file, find the correct file for this node
  return this.localSymbolTable().getValue().nodeToSymbol.get(node);
}

export function nodeReferences (this: Compiler, node: SyntaxNode): SyntaxNode[] {
  return this.localSymbolTable().getValue().nodeToSymbol.get(node)?.references ?? [];
}

export function nodeReferee (this: Compiler, node: SyntaxNode): NodeSymbol | undefined {
  return this.bindFile().getValue().nodeToReferee.get(node);
}

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
    const ownerSymbol = this.symbol.nodeSymbol(currentOwner);
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

export function symbolOfNameToKey (nameStack: string[], owner: { id: number }): string {
  return `${nameStack.join('.')}@${owner.id}`;
}
