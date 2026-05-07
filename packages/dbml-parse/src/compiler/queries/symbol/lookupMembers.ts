import {
  UNHANDLED,
} from '@/core/types/module';
import {
  SyntaxNode,
} from '@/core/types/nodes';
import {
  NodeSymbol, SymbolKind, UseSymbol,
} from '@/core/types/symbol';
import {
  useUtils,
} from '@/core/global_modules/use';
import type Compiler from '../../index';

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

  const members = this.symbolMembers(symbol).getFiltered(UNHANDLED);
  if (!members) return undefined;

  return members.find((m: NodeSymbol) => {
    if (kinds.length && !m.isKind(...kinds)) return false;
    if (m instanceof UseSymbol) {
      return useUtils.visibleName(this, m)?.at(-1) === targetName;
    }
    return m.name === targetName;
  });
}
