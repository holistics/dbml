import type Compiler from '@/compiler/index';
import {
  UNHANDLED,
} from '@/core/types/module';
import type {
  Ref, Table, TablePartial,
} from '@/core/types/schemaJson';
import {
  SymbolKind,
} from '@/core/types/symbol';
import type {
  ColumnSymbol, ColumnTypeInfo,
} from '@/core/types/symbol/symbols';
import {
  getMultiplicities,
} from '../../utils';

// Look up enum field names for a column's enum type via the symbol graph
export function getEnumMembers (colSymbol: ColumnSymbol, compiler: Compiler): string[] {
  const typeInfo = colSymbol.type(compiler);
  if (!typeInfo?.symbol) return [];

  const enumFields = compiler.symbolMembers(typeInfo.symbol).getFiltered(UNHANDLED);
  if (!enumFields) return [];

  return enumFields
    .filter((f) => f.isKind(SymbolKind.EnumField))
    .map((field) => field.name)
    .filter(Boolean) as string[];
}

function toInt (v: string | number): number {
  return typeof v === 'number' ? v : parseInt(String(v), 10);
}

export function parseNumericParams (typeInfo: ColumnTypeInfo): { precision: number;
  scale: number; } | undefined {
  if (!typeInfo.args || typeInfo.args.length === 0) return undefined;
  if (typeInfo.args.length >= 2) {
    const precision = toInt(typeInfo.args[0]);
    const scale = toInt(typeInfo.args[1]);
    if (!Number.isNaN(precision) && !Number.isNaN(scale)) return {
      precision,
      scale,
    };
  }
  if (typeInfo.args.length === 1) {
    const precision = toInt(typeInfo.args[0]);
    if (!Number.isNaN(precision)) return {
      precision,
      scale: 0,
    };
  }
  return undefined;
}

export function parseLengthParam (typeInfo: ColumnTypeInfo): { length: number } | undefined {
  if (!typeInfo.args || typeInfo.args.length === 0) return undefined;
  const length = toInt(typeInfo.args[0]);
  if (!Number.isNaN(length)) return {
    length,
  };
  return undefined;
}

export function extractInlineRefsFromTablePartials (table: Table, tablePartials: TablePartial[]): Ref[] {
  const refs: Ref[] = [];
  const originalFieldNames = new Set(table.fields.map((f) => f.name));

  for (const tablePartial of [
    ...table.partials,
  ].reverse()) {
    const {
      name,
    } = tablePartial;
    const partial = tablePartials.find((p) => p.name === name);
    if (!partial) continue;

    for (const field of partial.fields) {
      // Skip fields overridden by the original table
      if (originalFieldNames.has(field.name)) continue;

      for (const inlineRef of field.inline_refs) {
        const multiplicities = getMultiplicities(inlineRef.relation);
        if (!multiplicities) continue;
        refs.push({
          name: null,
          schemaName: null,
          token: inlineRef.token,
          endpoints: [
            {
              schemaName: inlineRef.schemaName,
              tableName: inlineRef.tableName,
              fieldNames: inlineRef.fieldNames,
              token: inlineRef.token,
              relation: multiplicities[1],
            },
            {
              schemaName: table.schemaName,
              tableName: table.name,
              fieldNames: [
                field.name,
              ],
              token: field.token,
              relation: multiplicities[0],
            },
          ],
        });
      }
    }
  }

  return refs;
}
