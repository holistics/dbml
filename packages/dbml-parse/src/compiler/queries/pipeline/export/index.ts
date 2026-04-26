import type Compiler from '@/compiler';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  UNHANDLED,
} from '@/core/types/module';
import Report from '@/core/types/report';
import type {
  Column, Database, Ref, Table, TablePartial,
} from '@/core/types/schemaJson';
import {
  NodeSymbol, SchemaSymbol, SymbolKind,
} from '@/core/types/symbol';
import {
  enrichWithCrossFileElements,
} from './enrichment';

// Export a Database JSON for a single file.
// Uses interpretSymbol with filepath context so element names are already resolved.
// Cross-file refs/records are pulled in via enrichment (they aren't owned by any single element).
export function exportSchemaJson (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  // interpretProject gives us per-file databases + merged items for cross-file enrichment
  const projectResult = this.interpretProject();
  const master = projectResult.getValue();
  const fileDb = master.files[filepath.absolute];
  if (!fileDb) return projectResult.map(() => undefined);

  // Re-interpret this file's program with filepath context for canonical names
  const ast = this.parseFile(filepath).getValue().ast;
  const symbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!symbol) return Report.create(undefined);

  const result = this.interpretSymbol(symbol, filepath);
  if (result.hasValue(UNHANDLED)) return new Report(undefined, projectResult.getErrors(), projectResult.getWarnings());

  const db = result.getValue() as Database | undefined;
  if (!db) return new Report(undefined, result.getErrors(), result.getWarnings());

  // Pull cross-file refs/records into scope
  enrichWithCrossFileElements(db, master.items, fileDb);

  // Rewrite ref endpoints to use canonical names for this file
  rewriteRefEndpoints(this, filepath, db.refs);

  const errors = [
    ...projectResult.getErrors(),
    ...result.getErrors(),
  ];
  const warnings = [
    ...projectResult.getWarnings(),
    ...result.getWarnings(),
  ];
  return new Report(stripDatabase(db), errors, warnings);
}

// Rewrite ref endpoint table names to match the consumer file's canonical names (aliases)
function rewriteRefEndpoints (compiler: Compiler, filepath: Filepath, refs: Ref[]): void {
  // Build a lookup: original schema.name → canonical name for this file
  const ast = compiler.parseFile(filepath).getValue().ast;
  const programSymbol = compiler.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!programSymbol) return;

  const nameMap = new Map<string, { schema: string | null; name: string }>();
  const members = compiler.symbolMembers(programSymbol).getFiltered(UNHANDLED) ?? [];

  for (const m of members) {
    if (m instanceof SchemaSymbol) {
      const schemaMembers = compiler.symbolMembers(m).getFiltered(UNHANDLED) ?? [];
      for (const sm of schemaMembers) {
        if (!sm.isKind(SymbolKind.Table)) continue;
        const original = sm.originalSymbol;
        const originalResolved = original.resolvedName(compiler);
        const key = `${originalResolved.schema ?? DEFAULT_SCHEMA_NAME}\0${originalResolved.name}`;
        const canonical = sm.resolvedName(compiler, filepath);
        nameMap.set(key, canonical);
      }
    }
  }

  for (const ref of refs) {
    if (!ref.endpoints) continue;
    for (const ep of ref.endpoints) {
      const key = `${ep.schemaName ?? DEFAULT_SCHEMA_NAME}\0${ep.tableName}`;
      const canonical = nameMap.get(key);
      if (canonical) {
        ep.tableName = canonical.name;
        ep.schemaName = canonical.schema;
      }
    }
  }
}

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
