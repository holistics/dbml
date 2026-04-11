import type Compiler from '../index';
import { NodeSymbol, SchemaSymbol, InjectedColumnSymbol, UseSymbol } from '@/core/types/symbol';
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
    // Check alias on the use specifier node (not the original declaration)
    if (symbol.useSpecifierDeclaration) {
      const aliasResult = this.nodeAlias(symbol.useSpecifierDeclaration);
      if (!aliasResult.hasValue(UNHANDLED) && aliasResult.getValue()) {
        return aliasResult.getValue();
      }
      const nameResult = this.nodeFullname(symbol.useSpecifierDeclaration);
      if (!nameResult.hasValue(UNHANDLED)) {
        const name = nameResult.getValue()?.at(-1);
        if (name) return name;
      }
    }
    // Fallback to original declaration name
    if (!symbol.declaration) return undefined;
    return this.nodeFullname(symbol.declaration).getFiltered(UNHANDLED)?.at(-1);
  }
  return this.nodeFullname(symbol.declaration).getFiltered(UNHANDLED)?.at(-1);
}
