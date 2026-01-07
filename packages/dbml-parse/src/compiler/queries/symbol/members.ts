import type Compiler from '../../index';
import { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { SymbolKind, destructureIndex } from '@/core/analyzer/symbol/symbolIndex';

export type MembersResult = readonly Readonly<{
  symbol: NodeSymbol;
  kind: SymbolKind;
  name: string;
}>[];

export function members (this: Compiler, ownerSymbol: NodeSymbol): MembersResult {
  if (!ownerSymbol.symbolTable) {
    return [];
  }

  return [...ownerSymbol.symbolTable.entries()].map(([index, symbol]) => ({
    ...destructureIndex(index).unwrap(),
    symbol,
  }));
}
