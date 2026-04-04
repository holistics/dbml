import type Compiler from '../index';
import { NodeSymbol, SchemaSymbol, InjectedSymbol } from '@/core/types/symbols';
import { UNHANDLED } from '@/constants';

// Get the short name of a symbol.
// For SchemaSymbol: uses its .name property directly.
// For InjectedSymbol: uses its .name property directly.
// For other symbols: uses the last segment of fullname(declaration).
export function symbolName (this: Compiler, symbol: NodeSymbol): string | undefined {
  if (symbol instanceof SchemaSymbol) return symbol.name;
  if (symbol instanceof InjectedSymbol) return symbol.name;
  if (!symbol.declaration) return undefined;
  const result = this.fullname(symbol.declaration);
  if (result.hasValue(UNHANDLED)) return undefined;
  return result.getValue()?.at(-1);
}
