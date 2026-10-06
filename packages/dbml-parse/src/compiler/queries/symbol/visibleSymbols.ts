import { UNHANDLED } from '@/core/types/module';
import { type ProgramSymbol, type RefSymbol, SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';
import { getProgramSymbol } from '@/core/global_modules/utils';

/**
  * Named refs usable from `program`: refs are not imported via `use`, a named ref is visible
  * wherever it shows up in the output (see isSymbolVisible).
  */
export function visibleSymbols (this: Compiler, program: ProgramSymbol, kind: SymbolKind): RefSymbol[] {
  return this.reachableFiles(program.filepath).flatMap((filepath) => {
    const programSymbol = getProgramSymbol(this, filepath);
    if (!programSymbol) return [];

    return programSymbol.declaration.body.flatMap((node) => {
      const symbol = this.nodeSymbol(node).getFiltered(UNHANDLED);
      if (!symbol?.isKind(kind)) return [];

      return this.isSymbolVisible(program, symbol) ? [symbol] : [];
    });
  });
}
