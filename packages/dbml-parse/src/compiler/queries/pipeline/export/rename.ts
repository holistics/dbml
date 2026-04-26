import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  AliasKind,
} from '@/core/types/schemaJson';
import type {
  Column, Database, DiagramView, Ref, RefEndpointPair, Table, TableGroup, TablePartial, TableRecord,
} from '@/core/types/schemaJson';

export class RenameContext {
  private maps = new Map<AliasKind, Map<string, string>>();

  constructor () {
    for (const k of Object.values(AliasKind)) this.maps.set(k, new Map());
  }

  private static toKey (schema: string | null, name: string): string {
    return `${schema ?? DEFAULT_SCHEMA_NAME}\0${name}`;
  }

  register (kind: AliasKind, schema: string | null, name: string, localName: string): void {
    this.maps.get(kind)!.set(RenameContext.toKey(schema, name), localName);
  }

  resolve (kind: AliasKind, schema: string | null, name: string): string | undefined {
    return this.maps.get(kind)?.get(RenameContext.toKey(schema, name));
  }
}

// Rewrite all element cross-references in a Database using the rename context.
export function applyDatabaseRenames (db: Database, ctx: RenameContext): Database {
  return {
    ...db,
    refs: db.refs.map((ref) => applyRefRenames(ref, ctx)),
    records: db.records.map((rec) => applyRecordRenames(rec, ctx)),
    tables: db.tables.map((t) => applyTableRenames(t, ctx)),
    tablePartials: db.tablePartials.map((tp) => applyTablePartialRenames(tp, ctx)),
    tableGroups: db.tableGroups.map((tg) => applyTableGroupRenames(tg, ctx)),
    diagramViews: db.diagramViews.map((dv) => applyDiagramViewRenames(dv, ctx)),
  };
}

// Ref: rewrite endpoint table references
function applyRefRenames (ref: Ref, ctx: RenameContext): Ref {
  const endpoints = ref.endpoints.map((ep) => {
    const local = ctx.resolve(AliasKind.Table, ep.schemaName, ep.tableName);
    return local
      ? {
          ...ep,
          tableName: local,
          schemaName: null,
        }
      : ep;
  }) as RefEndpointPair;
  if (endpoints[0] === ref.endpoints[0] && endpoints[1] === ref.endpoints[1]) return ref;
  return {
    ...ref,
    endpoints,
  };
}

// Record: rewrite table reference
function applyRecordRenames (record: TableRecord, ctx: RenameContext): TableRecord {
  const local = ctx.resolve(AliasKind.Table, record.schemaName ?? null, record.tableName);
  if (local) return {
    ...record,
    tableName: local,
    schemaName: undefined,
  };
  return record;
}

// Table/TablePartial: rewrite column inline refs + enum type references
function applyColumnRenames (col: Column, ctx: RenameContext): Column {
  // 1. Rewrite inline ref table references
  const inlineRefs = col.inline_refs.map((ref) => {
    const local = ctx.resolve(AliasKind.Table, ref.schemaName, ref.tableName);
    return local
      ? {
          ...ref,
          tableName: local,
          schemaName: null,
        }
      : ref;
  });
  // 2. Rewrite enum type references
  const enumLocal = col.type.isEnum
    ? ctx.resolve(AliasKind.Enum, col.type.schemaName, col.type.type_name)
    : undefined;
  const type = enumLocal
    ? {
        ...col.type,
        type_name: enumLocal,
        schemaName: null,
      }
    : col.type;

  if (inlineRefs.every((r, i) => r === col.inline_refs[i]) && !enumLocal) return col;
  return {
    ...col,
    inline_refs: inlineRefs,
    type,
  };
}

function applyTableRenames (table: Table, ctx: RenameContext): Table {
  const fields = table.fields.map((f) => applyColumnRenames(f, ctx));
  if (fields.every((f, i) => f === table.fields[i])) return table;
  return {
    ...table,
    fields,
  };
}

function applyTablePartialRenames (tp: TablePartial, ctx: RenameContext): TablePartial {
  const fields = tp.fields.map((f) => applyColumnRenames(f, ctx));
  if (fields.every((f, i) => f === tp.fields[i])) return tp;
  return {
    ...tp,
    fields,
  };
}

// TableGroup: rewrite table field references
function applyTableGroupRenames (tg: TableGroup, ctx: RenameContext): TableGroup {
  const tables = tg.tables.map((field) => {
    const local = ctx.resolve(AliasKind.Table, field.schemaName, field.name);
    return local
      ? {
          ...field,
          name: local,
          schemaName: null,
        }
      : field;
  });
  if (tables.every((f, i) => f === tg.tables[i])) return tg;
  return {
    ...tg,
    tables,
  };
}

// DiagramView: rewrite visible entity table references
function applyDiagramViewRenames (dv: DiagramView, ctx: RenameContext): DiagramView {
  if (!dv.visibleEntities.tables) return dv;
  const tables = dv.visibleEntities.tables.map((t) => {
    const local = ctx.resolve(AliasKind.Table, t.schemaName, t.name);
    return local
      ? {
          name: local,
          schemaName: '',
        }
      : t;
  });
  if (tables.every((t, i) => t === dv.visibleEntities.tables![i])) return dv;
  return {
    ...dv,
    visibleEntities: {
      ...dv.visibleEntities,
      tables,
    },
  };
}
