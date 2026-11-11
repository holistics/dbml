import type Compiler from '@/compiler/index';
import { ElementKind } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import type { ProgramSymbol } from '@/core/types/symbol';
import { MetadataTargetKind } from '@/core/types/symbol/kind';
import { DepMetadata, RefMetadata } from '@/core/types/symbol/metadata';
import { isElementNode } from '@/core/utils/validate';

// Metadata target kinds that are not symbols: a `Metadata Ref|Dep <name>` block targets the named element's metadata
export type NamedTargetKind = MetadataTargetKind.Ref | MetadataTargetKind.Dep;
export type NamedTargetMetadata = RefMetadata | DepMetadata;

const NAMED_TARGET_ELEMENT_KIND: Record<NamedTargetKind, ElementKind> = {
  [MetadataTargetKind.Ref]: ElementKind.Ref,
  [MetadataTargetKind.Dep]: ElementKind.Dep,
};

export function isNamedTargetKind (kind: MetadataTargetKind): kind is NamedTargetKind {
  return kind in NAMED_TARGET_ELEMENT_KIND;
}

/**
  * The named standalone refs/deps usable from `program`: they are not imported via `use`, a named ref/dep is usable
  * wherever it applies (the program reaches its file and sees all of its endpoint tables).
  *
  * Cycle rule: this is reachable from NodeMetadata.targets() (through MetadataElementMetadata.targets()), so it must not read the resolution index.
  * It scans the top-level declarations of the reachable files directly.
  */
export function getProgramNamedMetadata (compiler: Compiler, program: ProgramSymbol, kind: NamedTargetKind): NamedTargetMetadata[] {
  const elementKind = NAMED_TARGET_ELEMENT_KIND[kind];

  return compiler.reachableFiles(program.filepath).flatMap((filepath) => {
    const ast = compiler.parseFile(filepath).getValue().ast;

    return ast.body.flatMap((node) => {
      if (!isElementNode(node, elementKind)) return [];

      const meta = compiler.nodeMetadata(node).getFiltered(UNHANDLED);
      if (!(meta instanceof RefMetadata || meta instanceof DepMetadata) || meta.name(compiler) === undefined) return [];

      return meta.isVisibleFrom(compiler, program) ? [meta] : [];
    });
  });
}
