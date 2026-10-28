import Report from '@/core/types/report';
import { AliasSymbol, NodeSymbol } from '@/core/types/symbol';
import type Compiler from '../../index';
import { allVisibleMembers } from '../utils';

// All AliasSymbols across the project that alias `symbol` (transitive)
export function symbolAliases (this: Compiler, symbol: NodeSymbol): Report<AliasSymbol[]> {
  const target = symbol.originalSymbol;
  return allVisibleMembers(this).map((all) =>
    all.filter((member): member is AliasSymbol => member instanceof AliasSymbol && member.originalSymbol === target && member !== symbol),
  );
}
