import {
  UNHANDLED,
} from '@/core/types/module';
import {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  NodeSymbol, SchemaSymbol, SymbolKind,
} from '@/core/types/symbol';
import type Compiler from '../index';

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

      const name = m.name;
      return name === targetName;
    }),
  );
}
