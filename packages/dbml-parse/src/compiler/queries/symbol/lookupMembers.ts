import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  NodeSymbol, SchemaSymbol, SymbolKind, UseSymbol,
} from '@/core/types/symbol';
import {
  useUtils,
} from '@/core/global_modules/use';
import type Compiler from '../../index';

export function lookupMembers (
  this: Compiler,
  symbolOrNode: NodeSymbol | SyntaxNode,
  targetKind: SymbolKind | SymbolKind[],
  targetName: string,
  ignoreNotFound?: boolean,
  errorNode?: SyntaxNode,
): Report<NodeSymbol | undefined> {
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

  const kinds = Array.isArray(targetKind)
    ? targetKind
    : [
        targetKind,
      ];

  const members = this.symbolMembers(symbol).getFiltered(UNHANDLED);
  if (!members) return Report.create(undefined);

  const match = members.find((m: NodeSymbol) => {
    if (kinds.length && !m.isKind(...kinds)) return false;
    if (m instanceof UseSymbol) {
      return useUtils.visibleName(this, m)?.at(-1) === targetName;
    }
    return m.name === targetName;
  });

  if (!match && !ignoreNotFound) {
    const kindLabel = kinds.length ? kinds[0] : 'member';
    const parentName = symbol.declaration ? this.nodeFullname(symbol.declaration).getFiltered(UNHANDLED)?.join('.') : undefined;
    const scopeLabel = symbol instanceof SchemaSymbol
      ? `Schema '${symbol.name}'`
      : parentName
        ? `${symbol.kind} '${parentName}'`
        : (symbol.isKind(SymbolKind.Program)
            ? `Schema '${DEFAULT_SCHEMA_NAME}'`
            : 'global scope');

    return new Report(undefined, errorNode || symbol.declaration
      ? [
          new CompileError(
            CompileErrorCode.BINDING_ERROR,
            `${kindLabel} '${targetName}' does not exist in ${scopeLabel}`,
            (errorNode ?? symbol.declaration)!,
          ),
        ]
      : []);
  }

  return Report.create(match);
}
