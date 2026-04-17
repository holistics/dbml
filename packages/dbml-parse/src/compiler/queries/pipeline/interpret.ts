import type Compiler from '@/compiler';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  AliasKind,
} from '@/core/types';
import type {
  Database, ElementRef, MasterDatabase, SchemaElement, Table, TablePartial,
} from '@/core/types';
import type {
  CompileError, CompileWarning,
} from '@/core/types/errors';
import {
  Filepath, type FilepathId,
} from '@/core/types/filepath';
import {
  UNHANDLED,
} from '@/core/types/module';
import Report from '@/core/types/report';

// Strip internal-only column type properties for public JSON export.
function stripColumnInternals<T extends Table | TablePartial> (table: T): T {
  return {
    ...table,
    fields: table.fields.map((c) => ({
      ...c,
      type: {
        ...c.type,
        isEnum: undefined,
        lengthParam: undefined,
        numericParams: undefined,
      },
    })),
  };
}

function stripDatabase (db: Database): Database {
  return {
    ...db,
    tables: db.tables.map(stripColumnInternals),
    tablePartials: db.tablePartials.map(stripColumnInternals),
  };
}

// Interpret a single file. Returns raw Database
export function interpretFile (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  return this.parseFile(filepath).chain(({
    ast,
  }) =>
    this.interpretNode(ast).map((v) => v === UNHANDLED ? undefined : v as Database),
  );
}

// Interpret all files. Returns raw MasterDatabase
export function interpretProject (this: Compiler): Report<MasterDatabase> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];

  // Collect all reachable files from all entry points
  const visited = new Set<FilepathId>();
  const allFiles: Filepath[] = [];
  for (const entry of this.layout.getEntryPoints()) {
    for (const file of this.reachableFiles(entry)) {
      const id = file.intern();
      if (visited.has(id)) continue;
      visited.add(id);
      allFiles.push(file);
    }
  }

  // Interpret each file
  const perFile = new Map<string, Database>();
  for (const file of allFiles) {
    const parseResult = this.parseFile(file);
    errors.push(...parseResult.getErrors());
    warnings.push(...parseResult.getWarnings());
    const result = this.interpretNode(parseResult.getValue().ast);
    const db = result.getFiltered(UNHANDLED);
    if (db) {
      perFile.set(file.absolute, db as Database);
    }
    errors.push(...result.getErrors());
    warnings.push(...result.getWarnings());
  }

  // Merge all per-file databases into a flat MasterDatabase
  const merged: Database = {
    schemas: [],
    tables: [],
    notes: [],
    refs: [],
    enums: [],
    tableGroups: [],
    aliases: [],
    tablePartials: [],
    records: [],
    externals: {
      tables: [],
      enums: [],
      tableGroups: [],
      tablePartials: [],
      notes: [],
    },
    diagramViews: [],
  };

  const files: Record<string, Database> = {};

  for (const [
    fileId,
    db,
  ] of perFile) {
    files[fileId] = db;

    // Merge into flat items (only local elements, not externals)
    merged.tables.push(...db.tables);
    merged.notes.push(...db.notes);
    merged.refs.push(...db.refs);
    merged.enums.push(...db.enums);
    merged.tableGroups.push(...db.tableGroups);
    merged.aliases.push(...db.aliases);
    merged.tablePartials.push(...db.tablePartials);
    merged.records.push(...db.records);
    merged.diagramViews.push(...db.diagramViews);
    if (db.project && !merged.project) merged.project = db.project;
  }

  return new Report({
    files,
    items: merged,
  }, errors, warnings);
}

// Export a reconciled, stripped Database for a single file.
// 1. Collect all items by canonical name (schemaName.name), using filepath to disambiguate
// 2. For each external, find the canonical item and add it with the primary local name
// 3. If an element has multiple aliases, original name (if directly imported) or first alias becomes primary; rest go to Alias array
// 4. Rename refs/records endpoints to use local names
// 5. Alias replaces both schema and name: use { table auth.users as u } -> name: 'u', schemaName: null
export function exportSchemaJson (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  const projectResult = this.interpretProject();
  const master = projectResult.getValue();

  const fileDb = master.files[filepath.absolute];
  if (!fileDb) {
    return projectResult.map(() => undefined);
  }

  const allItems = master.items;

  // Build rename map: canonical "schemaName.name" -> local primary name
  const renameMap = new Map<string, string>();

  // Start with local items (identity mapping in rename map)
  const reconciled: Database = {
    ...fileDb,
    tables: [
      ...fileDb.tables,
    ],
    notes: [
      ...fileDb.notes,
    ],
    refs: [
      ...fileDb.refs,
    ],
    enums: [
      ...fileDb.enums,
    ],
    tableGroups: [
      ...fileDb.tableGroups,
    ],
    aliases: [
      ...fileDb.aliases,
    ],
    tablePartials: [
      ...fileDb.tablePartials,
    ],
    records: [
      ...fileDb.records,
    ],
  };

  for (const t of fileDb.tables) renameMap.set(canonicalElementKey(t.schemaName, t.name), t.name);

  // Reconcile externals: visibleNames[0] is the primary name, the rest become aliases.
  const externalKinds: Array<[ElementRef[], AliasKind]> = [
    [
      fileDb.externals.tables,
      AliasKind.Table,
    ],
    [
      fileDb.externals.enums,
      AliasKind.Enum,
    ],
    [
      fileDb.externals.tableGroups,
      AliasKind.TableGroup,
    ],
    [
      fileDb.externals.tablePartials,
      AliasKind.TablePartial,
    ],
    [
      fileDb.externals.notes,
      AliasKind.Note,
    ],
  ];

  for (const [
    refs,
    kind,
  ] of externalKinds) {
    for (const ext of refs) {
      if (ext.visibleNames.length === 0) continue;
      const [
        primaryVisible,
        ...restVisible
      ] = ext.visibleNames;
      const primaryName = primaryVisible.name;

      // Find canonical item from merged items
      const found = findItem(allItems, kind, ext.name, ext.schemaName);
      if (!found) continue;

      // Add with primary name; strip schema only when an alias was used
      const isRenamed = primaryName !== ext.name;
      pushItem(reconciled, kind, isRenamed
        ? {
            ...found,
            name: primaryName,
            schemaName: null,
          }
        : found);

      if (kind === AliasKind.Table) {
        renameMap.set(canonicalElementKey(ext.schemaName, ext.name), primaryName);
      }

      // Remaining visible names -> Alias array
      for (const visible of restVisible) {
        reconciled.aliases.push({
          name: visible.name,
          kind,
          value: {
            elementName: primaryName,
            tableName: primaryName,
            schemaName: null,
          },
        });
      }
    }
  }

  // Collect cross-file refs whose endpoints are all visible (by canonical name)
  for (const ref of allItems.refs) {
    if (reconciled.refs.includes(ref)) continue;
    if (ref.endpoints.every((ep) => renameMap.has(canonicalElementKey(ep.schemaName, ep.tableName)))) {
      reconciled.refs.push(ref);
    }
  }

  // Collect cross-file records whose table is visible
  for (const rec of allItems.records) {
    if (reconciled.records.includes(rec)) continue;
    if (renameMap.has(canonicalElementKey(rec.schemaName ?? null, rec.tableName))) {
      reconciled.records.push(rec);
    }
  }

  // Rewrite ref endpoints to local names
  reconciled.refs = reconciled.refs.map((ref) => ({
    ...ref,
    endpoints: ref.endpoints.map((ep) => {
      const local = renameMap.get(canonicalElementKey(ep.schemaName, ep.tableName));
      return (local && (local !== ep.tableName || ep.schemaName))
        ? {
            ...ep,
            tableName: local,
            schemaName: null,
          }
        : ep;
    }) as typeof ref.endpoints,
  }));

  // Rewrite record table references to local names
  reconciled.records = reconciled.records.map((rec) => {
    const local = renameMap.get(canonicalElementKey(rec.schemaName ?? null, rec.tableName));
    return (local && (local !== rec.tableName || rec.schemaName))
      ? {
          ...rec,
          tableName: local,
          schemaName: undefined,
        }
      : rec;
  });

  return new Report(stripDatabase(reconciled), projectResult.getErrors(), projectResult.getWarnings());
}

// Normalize schemaName so `null`, `undefined`, and the implicit DEFAULT_SCHEMA_NAME
// ('public') collapse to a single canonical form. Externals carry the literal
// 'public' via nodeFullname while local items store null — without normalization
// the two never line up.
function normSchema (schema: string | null | undefined): string {
  return schema ?? DEFAULT_SCHEMA_NAME;
}

function canonicalElementKey (schema: string | null | undefined, name: string): string {
  return `${normSchema(schema)}.${name}`;
}

function findItem (items: Database, kind: AliasKind, name: string, schema: string | null): SchemaElement | undefined {
  const s = normSchema(schema);
  switch (kind) {
    case AliasKind.Table: return items.tables.find((t) => t.name === name && normSchema(t.schemaName) === s);
    case AliasKind.Enum: return items.enums.find((e) => e.name === name && normSchema(e.schemaName) === s);
    case AliasKind.TableGroup: return items.tableGroups.find((g) => g.name === name);
    case AliasKind.TablePartial: return items.tablePartials.find((p) => p.name === name);
    case AliasKind.Note: return items.notes.find((n) => n.name === name);
    default: {
      const _: never = kind;
      return _;
    }
  }
}

function pushItem (db: Database, kind: AliasKind, item: any): void {
  switch (kind) {
    case AliasKind.Table: db.tables.push(item); break;
    case AliasKind.Enum: db.enums.push(item); break;
    case AliasKind.TableGroup: db.tableGroups.push(item); break;
    case AliasKind.TablePartial: db.tablePartials.push(item); break;
    case AliasKind.Note: db.notes.push(item); break;
    default: {
      const _: never = kind;
      void _;
    }
  }
}
