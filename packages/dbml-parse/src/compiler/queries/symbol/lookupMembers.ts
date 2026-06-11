import { UNHANDLED } from '@/core/types/module';
import { SyntaxNode } from '@/core/types/nodes';
import { NodeSymbol, SymbolKind, UseSymbol } from '@/core/types/symbol';
import { useUtils } from '@/core/global_modules/use';
import type Compiler from '../../index';

// From a list of symbol members
// Returns a Map from member name to the list of members with that name.
// This is for pure performance purposes
// As looking up in a list repeatedly in `lookupMembers` is too slow
export function symbolMembersLookupMap (
  this: Compiler,
  symbol: NodeSymbol,
): Map<string, NodeSymbol[]> {
  const members = this.symbolMembers(symbol).getFiltered(UNHANDLED);
  const result = new Map<string, NodeSymbol[]>();

  if (members) {
    for (const m of members) {
      const name = m instanceof UseSymbol
        ? useUtils.visibleName(this, m)?.at(-1)
        : m.name;
      if (name === undefined) continue;
      let arr = result.get(name);
      if (!arr) {
        arr = [];
        result.set(name, arr);
      }
      arr.push(m);
    }
  }

  return result;
}

export function lookupMembers (
  this: Compiler,
  symbolOrNode: NodeSymbol | SyntaxNode,
  targetKinds: SymbolKind | SymbolKind[],
  targetName: string,
): NodeSymbol | undefined {
  let symbol: NodeSymbol;
  if (symbolOrNode instanceof NodeSymbol) {
    symbol = symbolOrNode;
  } else {
    const nodeSymbol = this.nodeSymbol(symbolOrNode).getFiltered(UNHANDLED);
    if (!(nodeSymbol instanceof NodeSymbol)) {
      return undefined;
    }
    symbol = nodeSymbol;
  }

  const kinds = Array.isArray(targetKinds)
    ? targetKinds
    : [
        targetKinds,
      ];

  const candidates = this.symbolMembersLookupMap(symbol).get(targetName);
  if (!candidates) return undefined;

  return candidates.find((m: NodeSymbol) => {
    if (kinds.length === 1 && m.kind !== kinds[0]) return false;
    if (kinds.length > 1 && !kinds.includes(m.kind)) return false;
    return true;
  });
}
