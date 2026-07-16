import type Compiler from '@/compiler/index';
import type { CompileWarning } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import type { Ref, RefEndpoint, TableRecord } from '@/core/types/schemaJson';
import {
  ProgramSymbol,
  SchemaSymbol,
  SymbolKind,
  TableSymbol,
} from '@/core/types/symbol';
import type { InternedNodeSymbol } from '@/core/types/symbol/symbols';
import { InjectedColumnSymbol, TablePartialSymbol } from '@/core/types/symbol/symbols';
import { PartialRefMetadata, RecordsMetadata } from '@/core/types/symbol/metadata';
import { validateForeignKeys, validatePrimaryKey, validateUnique } from '../../records/utils/constraints';
import type { TableInfo } from '../../records/utils/constraints/fk';
import { getTokenPosition } from '@/core/utils/interpret';
import { getMultiplicities } from '../../utils';

export function validateRecords (
  compiler: Compiler,
  programSymbol: ProgramSymbol,
  refs: Ref[],
  filepath: Filepath,
): CompileWarning[] {
  const warnings: CompileWarning[] = [];
  const fkTableMap = new Map<InternedNodeSymbol, TableInfo>();

  // Seed fkTableMap with ALL table symbols
  const schemas = compiler.symbolMembers(programSymbol).getFiltered(UNHANDLED) ?? [];
  for (const schema of schemas) {
    if (!(schema instanceof SchemaSymbol)) continue;
    const members = compiler.symbolMembers(schema).getFiltered(UNHANDLED) ?? [];
    for (const member of members) {
      if (!member.isKind(SymbolKind.Table)) continue;
      const original = member.originalSymbol;
      if (!(original instanceof TableSymbol)) continue;
      const key = original.intern();
      if (!fkTableMap.has(key)) {
        fkTableMap.set(key, {
          tableSymbol: original,
          record: undefined,
          recordBlock: original.declaration,
        });
      }
    }
  }

  // Fill in records and run PK/unique validation
  const metadatas = compiler.symbolMetadata(programSymbol);
  for (const meta of metadatas) {
    if (!(meta instanceof RecordsMetadata)) continue;
    const tableSymbol = meta.table(compiler);
    if (!(tableSymbol instanceof TableSymbol)) continue;

    const result = compiler.interpretMetadata(meta, filepath);
    if (result.hasValue(UNHANDLED)) continue;
    const record = result.getValue() as TableRecord | undefined;
    if (!record) continue;

    warnings.push(...validatePrimaryKey(compiler, tableSymbol, meta.declaration, record));
    warnings.push(...validateUnique(compiler, tableSymbol, record));

    const key = tableSymbol.originalSymbol.intern();
    const entry = fkTableMap.get(key);
    if (entry) entry.record = record;
    else fkTableMap.set(key, {
      tableSymbol,
      record,
      recordBlock: meta.declaration,
    });
  }

  const partialRefs = collectPartialRefs(compiler, programSymbol, fkTableMap, filepath);
  warnings.push(...validateForeignKeys(compiler, [
    ...refs,
    ...partialRefs,
  ], fkTableMap, filepath));
  return warnings;
}

function collectPartialRefs (
  compiler: Compiler,
  programSymbol: ProgramSymbol,
  fkTableMap: Map<InternedNodeSymbol, TableInfo>,
  filepath: Filepath,
): Ref[] {
  const partialMetas = compiler.symbolMetadata(programSymbol)
    .filter((m): m is PartialRefMetadata => m instanceof PartialRefMetadata);

  const refs: Ref[] = [];
  for (const { tableSymbol } of fkTableMap.values()) {
    for (const partialSymbol of tableSymbol.resolvedPartials(compiler)) {
      for (const meta of partialMetas) {
        const container = meta.leftTablePartial(compiler);
        if (container?.originalSymbol !== partialSymbol.originalSymbol) continue;

        const leftColumns = meta.leftColumns(compiler);
        const rightTableOrPartial = meta.rightTable(compiler);
        const rightColumns = meta.rightColumns(compiler);
        const op = meta.op(compiler);
        if (!rightTableOrPartial || !op || leftColumns.length === 0 || rightColumns.length === 0) continue;

        // Skip if the column from the partial was not actually injected into this table
        const mergedCols = tableSymbol.mergedColumns(compiler);
        const anyInjected = leftColumns.some((leftColumn) =>
          mergedCols.some((mergedColumns) => mergedColumns instanceof InjectedColumnSymbol && mergedColumns.declaration === leftColumn.declaration),
        );
        if (!anyInjected) continue;

        const multiplicities = getMultiplicities(op);
        if (!multiplicities) continue;

        // When rightTable is the partial itself (inline self-reference),
        // resolve it to the concrete table being expanded.
        const rightTable = rightTableOrPartial instanceof TablePartialSymbol
          && rightTableOrPartial.originalSymbol === partialSymbol.originalSymbol
          ? tableSymbol
          : rightTableOrPartial;

        const leftName = tableSymbol.interpretedName(compiler, filepath);
        const rightName = rightTable.interpretedName(compiler, filepath);

        const ep1: RefEndpoint = {
          schemaName: leftName.schema,
          tableName: leftName.name,
          fieldNames: leftColumns.map((c) => c.name ?? ''),
          relation: multiplicities[0],
          token: getTokenPosition(meta.leftToken()),
        };
        const ep2: RefEndpoint = {
          schemaName: rightName.schema,
          tableName: rightName.name,
          fieldNames: rightColumns.map((c) => c.name ?? ''),
          relation: multiplicities[1],
          token: getTokenPosition(meta.rightToken()),
        };
        refs.push({
          token: getTokenPosition(meta.declaration),
          endpoints: [
            ep1,
            ep2,
          ],
        } as Ref);
      }
    }
  }
  return refs;
}
