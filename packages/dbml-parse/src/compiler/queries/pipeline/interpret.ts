import type Compiler from '@/compiler';
import { DEFAULT_ENTRY, UNHANDLED } from '@/constants';
import Report from '@/core/report';
import type { Database, MasterDatabase, Table, TablePartial } from '@/core/types';
import { Filepath, type FilepathId } from '@/core/types/filepath';
import type { CompileError, CompileWarning } from '@/core/errors';

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
  const ast = this.parseFile(filepath).getValue().ast;
  return this.interpretNode(ast).map((v) => v === UNHANDLED ? undefined : v as Database);
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
    const ast = this.parseFile(file).getValue().ast;
    const result = this.interpretNode(ast);
    if (result.getFiltered(UNHANDLED)) {
      perFile.set(file.absolute, result.getValue() as Database);
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
  };

  const files: Record<string, Database> = {};

  for (const [fileId, db] of perFile) {
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
    if (db.project && !merged.project) merged.project = db.project;
  }

  return new Report({ files, items: merged }, errors, warnings);
}

// Export a reconciled, stripped Database for a single file
// Consumers should use this query
export function exportSchemaJson (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  const fp = filepath ?? DEFAULT_ENTRY;
  const projectResult = this.interpretProject();
  const master = projectResult.getValue();

  const fileDb = master.files[fp.absolute];
  if (!fileDb) {
    return projectResult.map(() => undefined);
  }

  // Start with the file's own local items
  const reconciled: Database = {
    ...fileDb,
    // Clone arrays so we can push imported items
    tables: [...fileDb.tables],
    notes: [...fileDb.notes],
    refs: [...fileDb.refs],
    enums: [...fileDb.enums],
    tableGroups: [...fileDb.tableGroups],
    aliases: [...fileDb.aliases],
    tablePartials: [...fileDb.tablePartials],
    records: [...fileDb.records],
  };

  // Resolve externals: find actual items from master.items and add them with aliased names
  const allItems = master.items;

  for (const ext of fileDb.externals.tables) {
    const found = allItems.tables.find((t) => t.name === ext.name && (t.schemaName ?? null) === ext.schemaName);
    if (found) reconciled.tables.push(ext.aliasedName !== ext.name ? { ...found, name: ext.aliasedName, alias: found.alias } : found);
  }
  for (const ext of fileDb.externals.enums) {
    const found = allItems.enums.find((e) => e.name === ext.name && (e.schemaName ?? null) === ext.schemaName);
    if (found) reconciled.enums.push(ext.aliasedName !== ext.name ? { ...found, name: ext.aliasedName } : found);
  }
  for (const ext of fileDb.externals.tableGroups) {
    const found = allItems.tableGroups.find((g) => g.name === ext.name);
    if (found) reconciled.tableGroups.push(ext.aliasedName !== ext.name ? { ...found, name: ext.aliasedName } : found);
  }
  for (const ext of fileDb.externals.tablePartials) {
    const found = allItems.tablePartials.find((p) => p.name === ext.name);
    if (found) reconciled.tablePartials.push(ext.aliasedName !== ext.name ? { ...found, name: ext.aliasedName } : found);
  }
  for (const ext of fileDb.externals.notes) {
    const found = allItems.notes.find((n) => (n as any).name === ext.name);
    if (found) reconciled.notes.push(found);
  }

  const visibleTables = new Set(reconciled.tables.map((t) => `${t.schemaName ?? ''}.${t.name}`));
  // Also include refs that reference tables visible in this file
  for (const ref of allItems.refs) {
    if (reconciled.refs.includes(ref)) continue; // already local
    if (ref.endpoints.every((ep) => visibleTables.has(`${ep.schemaName ?? ''}.${ep.tableName}`))) {
      reconciled.refs.push(ref);
    }
  }

  // Also include records that reference tables visible in this file
  for (const records of allItems.records) {
    if (reconciled.records.includes(records)) continue; // already local
    if (visibleTables.has(`${records.schemaName ?? ''}.${records.tableName}`)) {
      reconciled.records.push(records);
    }
  }

  return new Report(stripDatabase(reconciled), projectResult.getErrors(), projectResult.getWarnings());
}
