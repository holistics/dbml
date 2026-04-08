import type Compiler from '../index';
import { NodeSymbol, SchemaSymbol, InjectedColumnSymbol } from '@/core/types/symbols';
import { UNHANDLED } from '@/constants';

// Get the names associated with a symbol for duplicate checking and lookup.
// For SchemaSymbol: uses its .name property directly.
// For InjectedSymbol: uses its .name property directly.
// For other symbols: uses both the last segment of fullname(declaration) AND its alias if they exist.
export function symbolNames (this: Compiler, symbol: NodeSymbol): string[] {
  if (symbol instanceof SchemaSymbol) return [symbol.name];
  if (symbol instanceof InjectedColumnSymbol) return [symbol.name];
  if (!symbol.declaration) return [];

  const names: string[] = [];
  const result = this.fullname(symbol.declaration);
  if (!result.hasValue(UNHANDLED)) {
    const name = result.getValue()?.at(-1);
    if (name) names.push(name);
  }

  const aliasResult = this.alias(symbol.declaration);
  if (!aliasResult.hasValue(UNHANDLED) && aliasResult.getValue()) {
    names.push(aliasResult.getValue()!);
  }

  return names;
}
