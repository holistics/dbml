import type Compiler from '../index';
import { NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbol';
import Report from '@/core/types/report';
import { UNHANDLED } from '@/constants';
import { SyntaxNode } from '@/core/types/nodes';

export function lookupMembers (this: Compiler, symbolOrNode: NodeSymbol | SyntaxNode, targetKind: SymbolKind, targetName: string): Report<NodeSymbol | undefined> {
  let symbol: NodeSymbol;
  if (symbolOrNode instanceof NodeSymbol) {
    symbol = symbolOrNode;
  } else {
    const nodeSymbolReport = this.nodeSymbol(symbolOrNode);
    const nodeSymbol = nodeSymbolReport.getValue();
    if (!(nodeSymbol instanceof NodeSymbol)) {
      return new Report(undefined, nodeSymbolReport.getErrors(), nodeSymbolReport.getWarnings());
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
      const alias = (symbol instanceof SchemaSymbol || symbol.isKind(SymbolKind.Program)) && m.declaration ? this.nodeAlias(m.declaration).getFiltered(UNHANDLED) : undefined;
      return name === targetName || alias === targetName;
    }),
  );
}
