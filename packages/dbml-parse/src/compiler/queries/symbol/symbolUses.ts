import Report from '@/core/types/report';
import { NodeSymbol, UseSymbol } from '@/core/types/symbol';
import type Compiler from '../../index';
import { allVisibleMembers } from '../utils';

// All UseSymbols across the project that import `symbol` (transitive).
export function symbolUses (this: Compiler, symbol: NodeSymbol): Report<UseSymbol[]> {
  const target = symbol.originalSymbol;
  return allVisibleMembers(this).map((all) =>
    all.filter((m): m is UseSymbol => m instanceof UseSymbol && m.originalSymbol === target && m !== symbol),
  );
}
