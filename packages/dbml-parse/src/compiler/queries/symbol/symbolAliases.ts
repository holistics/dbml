import Report from '@/core/types/report';
import { AliasSymbol, NodeSymbol } from '@/core/types/symbol';
import type Compiler from '../../index';
import { allVisibleMembers } from '../utils';

// All AliasSymbols across the project that alias `symbol` (transitive).
export function symbolAliases (this: Compiler, symbol: NodeSymbol): Report<AliasSymbol[]> {
  const target = symbol.originalSymbol;
  return allVisibleMembers(this).map((all) =>
    all.filter((m): m is AliasSymbol => m instanceof AliasSymbol && m.originalSymbol === target && m !== symbol),
  );
}
