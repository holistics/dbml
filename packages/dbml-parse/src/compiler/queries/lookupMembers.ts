import type Compiler from '../index';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import Report from '@/core/report';
import { UNHANDLED } from '@/constants';
import { SyntaxNode } from '@/core/parser/nodes';

export function lookupMembers (this: Compiler, symbolOrNode: NodeSymbol | SyntaxNode, targetKind: SymbolKind, targetName: string): Report<NodeSymbol | undefined> {
  let symbol: NodeSymbol;
  if (symbolOrNode instanceof NodeSymbol) {
    symbol = symbolOrNode;
  } else {
    const nodeSymbol = this.nodeSymbol(symbolOrNode).getValue();
    if (!(nodeSymbol instanceof NodeSymbol)) {
      return Report.create(undefined);
    }
    symbol = nodeSymbol;
  }
  const members = this.symbolMembers(symbol).getValue();
  if (members === UNHANDLED) {
    return Report.create(undefined);
  }
  return Report.create(
    members.find((m) => {
      if (!m.isKind(targetKind)) return false;

      const name = this.symbolName(m);
      if (name === targetName) return true;

      if (!m.declaration) return false;
      const alias = this.alias(m.declaration).getValue();
      return alias === targetName;
    }),
  );
}
