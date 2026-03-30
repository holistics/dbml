import type Compiler from '@/compiler/index';
import { Filepath } from '@/compiler/projectLayout';
import type { Database, InterpreterDatabase, Model, TablePartial } from '@/core/interpreter/types';
import type { CompileError, CompileWarning } from '@/core/errors';
import { ElementDeclarationNode } from '@/core/parser/nodes';
import Interpreter from '@/core/interpreter/interpreter';
import Report from '@/core/report';

function createEnv (source: string, tablePartials?: InterpreterDatabase['tablePartials']): InterpreterDatabase {
  return {
    schema: [],
    tables: new Map(),
    notes: new Map(),
    refIds: {},
    ref: new Map(),
    enums: new Map(),
    tableOwnerGroup: {},
    tableGroups: new Map(),
    aliases: [],
    project: new Map(),
    tablePartials: tablePartials ?? new Map(),
    records: new Map(),
    recordsElements: [],
    cachedMergedTables: new Map(),
    source,
  };
}

export function interpretFile (this: Compiler, filepath: Filepath): Report<Database> {
  const analysisReport = this.bindProject();

  if (analysisReport.getErrors().length > 0) {
    return new Report(emptyDatabase(filepath), analysisReport.getErrors(), analysisReport.getWarnings());
  }

  const { ast } = this.parseFile(filepath).getValue();

  return new Interpreter(this, ast, createEnv(ast.source)).interpret();
}

export function interpretProject (this: Compiler): Report<Model> {
  const files = this.layout().listAllFiles();

  if (files.length === 0) return new Report({ databases: [] }, [], []);

  const analysisReport = this.bindProject();

  if (analysisReport.getErrors().length > 0) {
    return new Report(
      { databases: files.map((fp) => emptyDatabase(fp)) },
      analysisReport.getErrors(),
      analysisReport.getWarnings(),
    );
  }

  // Shared tablePartials map across all files
  const tablePartials = new Map<ElementDeclarationNode, TablePartial>();

  const allErrors: CompileError[] = [];
  const allWarnings: CompileWarning[] = [...analysisReport.getWarnings()];

  // Interpret dependencies before the files that import them,
  // so shared tablePartials are populated before injection.
  const databaseMap = new Map<string, Database>();
  for (const file of [...files].reverse()) {
    const { ast } = this.parseFile(file).getValue();
    const interpretReport = new Interpreter(this, ast, createEnv(ast.source, tablePartials)).interpret();

    databaseMap.set(file.intern(), interpretReport.getValue());
    allErrors.push(...interpretReport.getErrors());
    allWarnings.push(...interpretReport.getWarnings());
  }

  const databases: Database[] = [];
  for (const file of files) {
    databases.push(databaseMap.get(file.intern())!);
  }

  return new Report({ databases }, allErrors, allWarnings);
}

function emptyDatabase (filepath: Filepath): Database {
  return { filepath, schemas: [], tables: [], notes: [], refs: [], enums: [], tableGroups: [], aliases: [], project: {}, tablePartials: [], records: [] };
}
