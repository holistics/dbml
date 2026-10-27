import { UNHANDLED } from '@/core/types/module';
import {
  type NodeSymbol, type ProgramSymbol, type SymbolKind, SchemaSymbol,
} from '@/core/types/symbol';
import type { InternedNodeSymbol } from '@/core/types/symbol/symbols';
import type Compiler from '../../index';

/**
  * Every member of `kind` Visible from `program` (declared in it, or imported through `use`), as original symbols, deduped by `intern()`.
  * Walks nested schemas too.
  */
export function visibleSymbols (this: Compiler, program: ProgramSymbol, ...kinds: SymbolKind[]): NodeSymbol[] {
  const seen = new Set<InternedNodeSymbol>();
  const result: NodeSymbol[] = [];

  const schemaQueue = (this.symbolMembers(program).getFiltered(UNHANDLED) ?? []).filter((s): s is SchemaSymbol => s instanceof SchemaSymbol);
  while (schemaQueue.length > 0) {
    const schema = schemaQueue.shift()!;
    for (const symbol of this.symbolMembers(schema).getFiltered(UNHANDLED) ?? []) {
      if (symbol instanceof SchemaSymbol) {
        schemaQueue.push(symbol);
        continue;
      }
      if (!symbol.isKind(...kinds)) continue;

      const original = symbol.originalSymbol;
      const key = original.intern();
      if (seen.has(key)) continue;

      seen.add(key);
      result.push(original);
    }
  }

  return result;
}
