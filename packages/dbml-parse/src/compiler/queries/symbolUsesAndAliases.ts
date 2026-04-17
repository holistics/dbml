import {
  UNHANDLED,
} from '@/core/types/module';
import {
  UseDeclarationNode, UseSpecifierListNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  AliasSymbol, NodeSymbol, UseSymbol,
} from '@/core/types/symbol';
import type Compiler from '../index';
import {
  usableMembers,
} from './usableMembers';

// Collect every UseSymbol declared across the project.
function allUseSymbols (compiler: Compiler): { symbols: UseSymbol[]; errors: any[]; warnings: any[] } {
  const astMap = compiler.parseProject();
  compiler.bindProject();
  const symbols: UseSymbol[] = [];
  const errors: any[] = [];
  const warnings: any[] = [];

  for (const astReport of astMap.values()) {
    errors.push(...astReport.getErrors());
    warnings.push(...astReport.getWarnings());
    const ast = astReport.getValue().ast;
    for (const element of ast.body) {
      if (!(element instanceof UseDeclarationNode)) continue;
      if (!(element.specifiers instanceof UseSpecifierListNode)) continue;
      for (const spec of element.specifiers.specifiers) {
        const sym = compiler.nodeSymbol(spec).getFiltered(UNHANDLED);
        if (sym instanceof UseSymbol) symbols.push(sym);
      }
    }
  }

  return { symbols, errors, warnings };
}

// Collect every AliasSymbol declared across the project.
function allAliasSymbols (compiler: Compiler): { symbols: AliasSymbol[]; errors: any[]; warnings: any[] } {
  const symbols: AliasSymbol[] = [];
  const errors: any[] = [];
  const warnings: any[] = [];

  for (const filepath of compiler.layout.getEntryPoints()) {
    const usable = usableMembers.call(compiler, filepath);
    errors.push(...usable.getErrors());
    warnings.push(...usable.getWarnings());
    const value = usable.getValue();
    for (const m of value.nonSchemaMembers) {
      if (m instanceof AliasSymbol) symbols.push(m);
    }
  }

  return { symbols, errors, warnings };
}

// Return all AliasSymbols whose (transitive) originalSymbol is `symbol`.
// AliasSymbol.originalSymbol unwraps the alias/use chain, so matching against
// symbol.originalSymbol captures aliases-of-aliases and aliases-of-uses.
export function symbolAliases (this: Compiler, symbol: NodeSymbol): Report<AliasSymbol[]> {
  const { symbols, errors, warnings } = allAliasSymbols(this);
  const target = symbol.originalSymbol;
  const result = symbols.filter((a) => a.originalSymbol === target && a !== symbol);
  return new Report(result, errors, warnings);
}

// Return all UseSymbols whose (transitive) originalSymbol is `symbol`.
// UseSymbol.originalSymbol unwraps the use/alias chain, so matching against
// symbol.originalSymbol captures uses-of-uses and uses-of-aliases.
export function symbolUses (this: Compiler, symbol: NodeSymbol): Report<UseSymbol[]> {
  const { symbols, errors, warnings } = allUseSymbols(this);
  const target = symbol.originalSymbol;
  const result = symbols.filter((u) => u.originalSymbol === target && u !== symbol);
  return new Report(result, errors, warnings);
}
