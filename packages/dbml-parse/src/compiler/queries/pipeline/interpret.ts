import type Compiler from '../../index';
import type { Filepath } from '../../projectLayout';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { Database } from '@/core/interpreter/types';
import Interpreter from '@/core/interpreter/interpreter';
import Report from '@/core/report';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Database> {
  const fileIndex = this.parseFile(filepath);
  const local = this.validateFile(filepath);
  const bound = this.bindFile(filepath);

  const allErrors = [...local.errors, ...bound.getErrors()];
  const allWarnings = [...local.warnings, ...bound.getWarnings()];

  if (allErrors.length > 0) {
    return new Report(emptyDatabase(), allErrors, allWarnings);
  }

  const { nodeToSymbol } = local;
  const { nodeToReferee, symbolToReferences } = bound.getValue();
  const interpretReport = new Interpreter({ ast: fileIndex.ast, nodeToSymbol, nodeToReferee, symbolToReferences }).interpret();

  return new Report(
    interpretReport.getValue(),
    [...allErrors, ...interpretReport.getErrors()],
    [...allWarnings, ...interpretReport.getWarnings()],
  );
}

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

function emptyDatabase (): Database {
  return { schemas: [], tables: [], notes: [], refs: [], enums: [], tableGroups: [], aliases: [], project: {}, tablePartials: [], records: [] };
}

export function interpretProject (this: Compiler): Report<Database> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];
  const databases: Database[] = [];

  for (const [, fileIndex] of this.parseProject()) {
    const result = this.interpretFile(fileIndex.path as Filepath);
    errors.push(...result.getErrors());
    warnings.push(...result.getWarnings());
    if (result.getErrors().length === 0) {
      databases.push(result.getValue());
    }
  }

  const database = databases.length > 0 ? mergeDatabases(databases) : emptyDatabase();
  return new Report(database, errors, warnings);
}
