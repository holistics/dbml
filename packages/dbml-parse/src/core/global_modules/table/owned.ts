import type Compiler from '@/compiler/index';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import type { CompileInfo, CompileWarning } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import Report from '@/core/types/report';
import type { SchemaElement } from '@/core/types/schemaJson';
import type { TableSymbol } from '@/core/types/symbol';
import {
  DepMetadata, type NodeMetadata, RecordsMetadata, RefMetadata,
} from '@/core/types/symbol/metadata';
import { getProgramSymbol } from '../utils';
import type { OwnedElement } from '../types';

/**
  * Interpret the Refs, Deps and Records that `table` owns and is responsible for emitting in the program of `filepath`.
  * - A Ref/Dep with several Owner tables is emitted only by its first Owner, so it is emitted once however many of its tables are visible.
  * - Records apply when the program reaches their file and sees the table. A table can only have one applying Records block.
  * Indexes and Checks are interpreted inside the TableInterpreter.
  * The output depends only on (table, filepath), not on what was interpreted before.
  */
export function interpretOwnedByTable (compiler: Compiler, table: TableSymbol, filepath: Filepath): Report<OwnedElement[]> {
  const program = getProgramSymbol(compiler, filepath);
  if (!program) return new Report([]);

  const owned: OwnedElement[] = [];
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];
  const infos: CompileInfo[] = [];

  const interpret = (metadata: NodeMetadata): SchemaElement | SchemaElement[] | undefined => {
    const result = compiler.interpretMetadata(metadata, filepath);
    if (result.hasValue(UNHANDLED)) return undefined;

    errors.push(...result.getErrors());
    warnings.push(...result.getWarnings());
    infos.push(...result.getInfos());

    return result.getValue();
  };

  const tableKey = table.originalSymbol.intern();
  const metas = compiler.symbolMetadata(table);

  for (const meta of metas) {
    if (!(meta instanceof RefMetadata || meta instanceof DepMetadata)) continue;
    // Only the first Owner emits, so a Ref/Dep between several tables is emitted once
    if (meta.owners(compiler)[0]?.intern() !== tableKey) continue;
    if (!meta.isVisibleFrom(compiler, program)) continue;

    const value = interpret(meta);
    if (value !== undefined) owned.push({ metadata: meta, value });
  }

  const records = metas.filter((m): m is RecordsMetadata => m instanceof RecordsMetadata && m.isVisibleFrom(compiler, program));
  for (const meta of records) {
    const value = interpret(meta);
    if (records.length > 1) {
      errors.push(new CompileError(
        CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE,
        `Duplicate Records blocks for the same Table '${table.name ?? ''}' - A Table can only have one Records block`,
        meta.declaration,
      ));
      continue;
    }
    if (value !== undefined) owned.push({ metadata: meta, value });
  }

  return new Report(owned, errors, warnings, infos);
}
