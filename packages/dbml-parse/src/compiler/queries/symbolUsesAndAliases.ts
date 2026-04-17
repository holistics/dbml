import {
  UNHANDLED,
} from '@/core/types/module';
import Report from '@/core/types/report';
import {
  AliasSymbol, NodeSymbol, SchemaSymbol, SymbolKind, UseSymbol,
} from '@/core/types/symbol';
import type Compiler from '../index';

// Canonical enumeration of visible symbols, rooted at each file's programSymbol.
//
// WARNING: always go through `compiler.symbolMembers` — never hit usableMembers
// or symbolFactory directly. AliasSymbol/UseSymbol instances are only canonical
// when reached via this path; other entry points mint fresh SchemaSymbols and
// spawn parallel copies, breaking identity comparison against nodeReferee.
function allVisibleMembers (compiler: Compiler): Report<NodeSymbol[]> {
  const members: NodeSymbol[] = [];
  const errors: any[] = [];
  const warnings: any[] = [];

  compiler.bindProject();
  for (const astReport of compiler.parseProject().values()) {
    errors.push(...astReport.getErrors());
    warnings.push(...astReport.getWarnings());
    const programSymbol = compiler.nodeSymbol(astReport.getValue().ast).getFiltered(UNHANDLED);
    if (!programSymbol) continue;

    const top = compiler.symbolMembers(programSymbol);
    errors.push(...top.getErrors());
    warnings.push(...top.getWarnings());
    for (const m of top.getFiltered(UNHANDLED) ?? []) {
      members.push(m);
      if (m instanceof SchemaSymbol && m.isKind(SymbolKind.Schema)) {
        const sub = compiler.symbolMembers(m);
        errors.push(...sub.getErrors());
        warnings.push(...sub.getWarnings());
        members.push(...(sub.getFiltered(UNHANDLED) ?? []));
      }
    }
  }

  return new Report(members, errors, warnings);
}

// All AliasSymbols across the project that alias `symbol` (transitive).
export function symbolAliases (this: Compiler, symbol: NodeSymbol): Report<AliasSymbol[]> {
  const target = symbol.originalSymbol;
  return allVisibleMembers(this).map((all) =>
    all.filter((m): m is AliasSymbol => m instanceof AliasSymbol && m.originalSymbol === target && m !== symbol),
  );
}

// All UseSymbols across the project that import `symbol` (transitive).
export function symbolUses (this: Compiler, symbol: NodeSymbol): Report<UseSymbol[]> {
  const target = symbol.originalSymbol;
  return allVisibleMembers(this).map((all) =>
    all.filter((m): m is UseSymbol => m instanceof UseSymbol && m.originalSymbol === target && m !== symbol),
  );
}
