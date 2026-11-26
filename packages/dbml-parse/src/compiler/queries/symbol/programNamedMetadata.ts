import type Compiler from '../../index';
import { UNHANDLED } from '@/core/types/module';
import {
  NAMED_TARGETS, type NamedTargetKind, type NamedTargetMetadata, type ProgramSymbol,
} from '@/core/types/symbol';
import { isElementNode } from '@/core/utils/validate';

/**
  * The named standalone refs/deps usable from `program`: they are not imported via `use`, a named ref/dep is usable
  * wherever it applies (the program reaches its file and sees all of its endpoint tables).
  *
  * Cycle rule: this is reachable from NodeMetadata.targets() (through MetadataElementMetadata.targets()), so it must not read the resolution index.
  * It scans the top-level declarations of the reachable files directly.
  */
export function programNamedMetadata (this: Compiler, program: ProgramSymbol, kind: NamedTargetKind): NamedTargetMetadata[] {
  const { elementKind, metadataClass } = NAMED_TARGETS[kind];

  return this.reachableFiles(program.filepath).flatMap((filepath) => {
    const ast = this.parseFile(filepath).getValue().ast;

    return ast.body.flatMap((node) => {
      if (!isElementNode(node, elementKind)) return [];

      const meta = this.nodeMetadata(node).getFiltered(UNHANDLED);
      if (!(meta instanceof metadataClass) || meta.name(this) === undefined) return [];

      return meta.isVisibleFrom(this, program) ? [meta] : [];
    });
  });
}
