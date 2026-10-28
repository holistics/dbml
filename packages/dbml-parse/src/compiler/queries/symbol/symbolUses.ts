import Report from '@/core/types/report';
import { NodeSymbol, UseSymbol } from '@/core/types/symbol';
import type Compiler from '../../index';
import { allVisibleMembers } from '../utils';

// All UseSymbols across the project that import `symbol` (transitive)
export function symbolUses (this: Compiler, symbol: NodeSymbol): Report<UseSymbol[]> {
  const target = symbol.originalSymbol;
  return allVisibleMembers(this).map((all) =>
    all.filter((member): member is UseSymbol => member instanceof UseSymbol && member.originalSymbol === target && member !== symbol),
  );
}
