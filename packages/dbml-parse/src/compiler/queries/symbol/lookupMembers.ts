import { UNHANDLED } from '@/core/types/module';
import { SyntaxNode } from '@/core/types/nodes';
import { NodeSymbol, SymbolKind, UseSymbol } from '@/core/types/symbol';
import { useUtils } from '@/core/global_modules/use';
import type Compiler from '../../index';

// From a list of symbol members, returns a Map from member name to the list of members with that name
// This is for pure performance: looking up in a list repeatedly in `lookupMembers` is too slow
export function symbolMembersLookupMap (
  this: Compiler,
  symbol: NodeSymbol,
): Map<string, NodeSymbol[]> {
  const members = this.symbolMembers(symbol).getFiltered(UNHANDLED);
  const result = new Map<string, NodeSymbol[]>();

  if (members) {
    for (const member of members) {
      const name = member instanceof UseSymbol
        ? useUtils.visibleName(this, member)?.at(-1)
        : member.name;
      if (name === undefined) continue;
      let array = result.get(name);
      if (!array) {
        array = [];
        result.set(name, array);
      }
      array.push(member);
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

  return candidates.find((member: NodeSymbol) => {
    if (kinds.length === 1 && member.kind !== kinds[0]) return false;
    if (kinds.length > 1 && !kinds.includes(member.kind)) return false;
    return true;
  });
}
