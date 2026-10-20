import { UNHANDLED } from '@/core/types/module';
import { type NodeSymbol, type ProgramSymbol, SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';
import { getProgramSymbol } from '@/core/global_modules/utils';

/**
  * Non-importable symbols (named refs, named deps) of `kind` usable from `program`: they are not imported via `use`,
  * such a symbol is visible wherever it shows up in the output (see isSymbolVisible).
  */
export function visibleSymbols (this: Compiler, program: ProgramSymbol, kind: SymbolKind): NodeSymbol[] {
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
