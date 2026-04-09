import type Compiler from '../index';
import { NodeSymbol, SchemaSymbol, InjectedColumnSymbol } from '@/core/types/symbols';
import { UNHANDLED } from '@/constants';

// Get the names associated with a symbol for duplicate checking and lookup.
// For SchemaSymbol: uses its .name property directly.
// For InjectedSymbol: uses its .name property directly.
// For other symbols: uses both the last segment of fullname(declaration)
export function symbolName (this: Compiler, symbol: NodeSymbol): string | undefined {
  if (symbol instanceof SchemaSymbol) return symbol.name;
  if (symbol instanceof InjectedColumnSymbol) return symbol.name;
  if (!symbol.declaration) return undefined;

  return this.fullname(symbol.declaration).getFiltered(UNHANDLED)?.at(-1);
}
