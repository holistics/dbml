import type Compiler from '@/compiler';
import type {
  Column, Database, MasterDatabase, Table, TablePartial,
} from '@/core/types/schemaJson';
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

function stripColumnInternals<T extends Table | TablePartial> (table: T): T {
  return {
    ...table,
    fields: table.fields.map((c: Column) => ({
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

// Interpret a single file. Strips internal fields from the output.
export function interpretFile (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  return this.parseFile(filepath).chain(({
    ast,
  }) => {
    const symbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
    if (!symbol) return Report.create(undefined);
    return this.interpretSymbol(symbol).map((v) => (v === UNHANDLED || !v) ? undefined : stripDatabase(v as Database));
  });
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
    const ast = parseResult.getValue().ast;
    const symbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
    const result = symbol ? this.interpretSymbol(symbol) : Report.create(UNHANDLED);
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
