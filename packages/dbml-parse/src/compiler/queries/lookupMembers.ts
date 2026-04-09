import type Compiler from '../index';
import { NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbols';
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
      const alias = (symbol instanceof SchemaSymbol || symbol.isKind(SymbolKind.Program)) && m.declaration ? this.alias(m.declaration).getFiltered(UNHANDLED) : undefined;
      return name === targetName || alias === targetName;
    }),
  );
}
