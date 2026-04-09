import type Compiler from '../index';
import { NodeSymbol, SchemaSymbol, InjectedColumnSymbol, UseSymbol } from '@/core/types/symbols';
import { UNHANDLED } from '@/constants';

// Get the names associated with a symbol for duplicate checking and lookup.
// For SchemaSymbol: uses its .name property directly.
// For InjectedSymbol: uses its .name property directly.
// For UseSymbol: uses its alias if exists, otherwise the last segment of fullname(declaration).
// For other symbols: uses the last segment of fullname(declaration)
export function symbolName (this: Compiler, symbol: NodeSymbol): string | undefined {
  if (symbol instanceof SchemaSymbol) return symbol.name;
  if (symbol instanceof InjectedColumnSymbol) return symbol.name;
  if (!symbol.declaration) return undefined;

  if (symbol instanceof UseSymbol) {
    const aliasResult = this.nodeAlias(symbol.declaration);
    if (!aliasResult.hasValue(UNHANDLED) && aliasResult.getValue()) {
      return aliasResult.getValue();
    }

    const result = this.nodeFullname(symbol.declaration);
    if (result.hasValue(UNHANDLED)) return undefined;
    const name = result.getValue()?.at(-1);
    return name ? name : undefined;
  }
  return this.nodeFullname(symbol.declaration).getFiltered(UNHANDLED)?.at(-1);
}
