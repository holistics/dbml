import type { Filepath } from '@/core/types/filepath';
import { type ProgramSymbol, SymbolKind } from '@/core/types/symbol';
import type { NodeMetadata } from '@/core/types/symbol/metadata';
import type Compiler from '../../index';

/**
  * The metadata declarations that apply in `program` (see Applies in CONTEXT.md), in declaration order
  * (file order of parseProject, then position in the file).
  * Gathered from the Owners that are Visible: every visible table, every visible table partial and the program itself (its Project).
  */
export function appliedMetadata (this: Compiler, program: ProgramSymbol): NodeMetadata[] {
  const owners = [
    ...this.visibleSymbols(program, SymbolKind.Table, SymbolKind.TablePartial),
    program,
  ];

  const seen = new Set<number>();
  const metas: NodeMetadata[] = [];
  for (const owner of owners) {
    for (const meta of this.symbolMetadata(owner)) {
      if (seen.has(meta.id)) continue;
      seen.add(meta.id);
      if (meta.isVisibleFrom(this, program)) metas.push(meta);
    }
  }

  return sortByDeclarationOrder(this, metas, (meta) => meta.declaration);
}

// Sort by file order of parseProject, then position in the file
export function sortByDeclarationOrder<T> (compiler: Compiler, items: T[], declarationOf: (item: T) => { filepath: Filepath; start: number }): T[] {
  const fileOrder = new Map<string, number>();
  [...compiler.parseProject().keys()].forEach((absolute, i) => fileOrder.set(absolute, i));
  const rank = (item: T) => fileOrder.get(declarationOf(item).filepath.absolute) ?? Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => (rank(a) - rank(b)) || (declarationOf(a).start - declarationOf(b).start));
}
