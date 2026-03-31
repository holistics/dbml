import type Compiler from '@/compiler/index';
import { Filepath } from '@/compiler/projectLayout';
import type { Database, MasterDatabase } from '@/core/interpreter/types';
import { InterpreterDatabase } from '@/core/interpreter/types';
import type { CompileError, CompileWarning } from '@/core/errors';
import Interpreter from '@/core/interpreter/interpreter';
import Report from '@/core/report';
import { collectTransitiveDependencies } from '../utils';

const emptyMaster: MasterDatabase = {
  files: {},
  items: {
    schemas: [],
    tables: [],
    notes: [],
    refs: [],
    enums: [],
    tableGroups: [],
    aliases: [],
    project: {},
    tablePartials: [],
    records: [],
  },
} as const;

export function interpretProject (this: Compiler): Report<MasterDatabase> {
  const analysisReport = this.bindProject();

  if (analysisReport.getErrors().length > 0) {
    return new Report(emptyMaster, analysisReport.getErrors(), analysisReport.getWarnings());
  }

  const visited = new Set<string>();
  const allFiles: Filepath[] = [];
  for (const entry of this.layout().getEntryPoints()) {
    for (const file of collectTransitiveDependencies(this, entry)) {
      if (visited.has(file.intern())) continue;
      visited.add(file.intern());
      allFiles.push(file);
    }
  }

  if (allFiles.length === 0) return new Report(emptyMaster, [], []);

  const env = new InterpreterDatabase();

  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [...analysisReport.getWarnings()];

  for (const file of [...allFiles].reverse()) {
    const { ast } = this.parseFile(file).getValue();
    const report = new Interpreter(this, ast, env).interpret();
    errors.push(...report.getErrors());
    warnings.push(...report.getWarnings());
  }

  collectImports(this, allFiles, analysisReport.getValue(), env);

  return new Report(env.toMasterDatabase(), errors, warnings);
}

export function interpretFile (this: Compiler, filepath: Filepath): Report<Database> {
  const masterReport = this.interpretProject();
  const master = masterReport.getValue();

  // Get the file index for this filepath
  const thisFileIndex = master.files[filepath.intern()];

  // tablesInFile = tables defined in file + imported tables
  const tablesInFile = new Set([
    ...(thisFileIndex?.tables ?? []).map((r) => r.aliasedName ?? r.name),
    ...(thisFileIndex?.imports ?? []).map((r) => r.aliasedName ?? r.name),
  ]);

  const filteredRefs = master.items.refs.filter((ref) =>
    ref.endpoints.every((endpoint) => tablesInFile.has(endpoint.tableName)),
  );

  const filteredRecords = items.records.filter((rec) => tablesInFile.has(rec.tableName));

  return new Report(
    {
      schemas: [],
      tables: items.tables.filter(definedInFile),
      notes: items.notes.filter(definedInFile),
      refs: filteredRefs,
      enums: items.enums.filter(definedInFile),
      tableGroups: items.tableGroups.filter(definedInFile),
      aliases: items.aliases,
      project: items.project,
      tablePartials: items.tablePartials.filter(definedInFile),
      records: filteredRecords,
    },
    masterReport.getErrors().filter((e) => e.nodeOrToken?.filepath?.equals(filepath)),
    masterReport.getWarnings().filter((w) => w.nodeOrToken?.filepath?.equals(filepath)),
  );
}
