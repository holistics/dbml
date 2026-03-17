import type Compiler from '../../index';
import type { Database } from '@/core/interpreter/types';
import type { CompileWarning } from '@/core/errors';
import Interpreter from '@/core/interpreter/interpreter';

function mergeDatabases (dbs: Database[]): Database {
  return {
    schemas: [],
    tables: dbs.flatMap((d) => d.tables),
    notes: dbs.flatMap((d) => d.notes),
    refs: dbs.flatMap((d) => d.refs),
    enums: dbs.flatMap((d) => d.enums),
    tableGroups: dbs.flatMap((d) => d.tableGroups),
    aliases: dbs.flatMap((d) => d.aliases),
    project: dbs.find((d) => Object.keys(d.project).length > 0)?.project ?? {},
    tablePartials: dbs.flatMap((d) => d.tablePartials),
    records: dbs.flatMap((d) => d.records),
  };
}

export function interpretProject (this: Compiler): { database: Database; warnings: CompileWarning[] } | undefined {
  const databases: Database[] = [];
  const warnings: CompileWarning[] = [];

  for (const analyzedFile of this.analyzeProject().values()) {
    if (analyzedFile.errors.length > 0) {
      continue;
    }

    const interpretReport = new Interpreter(analyzedFile.analysisResult).interpret();
    databases.push(interpretReport.getValue());
    warnings.push(...analyzedFile.warnings, ...interpretReport.getWarnings());
  }

  return databases.length > 0 ? { database: mergeDatabases(databases), warnings } : undefined;
}
