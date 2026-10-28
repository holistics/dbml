import type Compiler from '@/compiler/index';
import { ElementKind } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import type { ProgramSymbol } from '@/core/types/symbol';
import { RefMetadata } from '@/core/types/symbol/metadata';
import { isElementNode } from '@/core/utils/validate';

/**
  * The named standalone refs usable from `program`: refs are not imported via `use`, a named ref is usable
  * wherever it applies (the program reaches its file and sees both endpoint tables).
  *
  * Cycle rule: this is reachable from NodeMetadata.declaredTargets() (through MetadataElementMetadata.declaredTargets()), so it must not read the resolution index.
  * It scans the top-level declarations of the reachable files directly.
  */
export function namedRefsIn (compiler: Compiler, program: ProgramSymbol): RefMetadata[] {
  return compiler.reachableFiles(program.filepath).flatMap((filepath) => {
    const ast = compiler.parseFile(filepath).getValue().ast;

    return ast.body.flatMap((node) => {
      if (!isElementNode(node, ElementKind.Ref)) return [];

      const meta = compiler.nodeMetadata(node).getFiltered(UNHANDLED);
      if (!(meta instanceof RefMetadata) || meta.name(compiler) === undefined) return [];

      return meta.isVisibleFrom(compiler, program) ? [meta] : [];
    });
  });
}
