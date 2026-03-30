import type Compiler from '@/compiler/index';
import type { Filepath } from '@/compiler/projectLayout';
import { ProgramNode } from '@/core/parser/nodes';
import { Database, InterpreterDatabase, Table, TablePartial, TableRecord } from '@/core/interpreter/types';
import { AnalysisResult } from '@/core/binder/analyzer';
import { TableInterpreter } from '@/core/interpreter/elementInterpreter/table';
import { StickyNoteInterpreter } from '@/core/interpreter/elementInterpreter/sticky_note';
import { RefInterpreter } from '@/core/interpreter/elementInterpreter/ref';
import { TableGroupInterpreter } from '@/core/interpreter/elementInterpreter/tableGroup';
import { EnumInterpreter } from '@/core/interpreter/elementInterpreter/enum';
import { ProjectInterpreter } from '@/core/interpreter/elementInterpreter/project';
import { TablePartialInterpreter } from '@/core/interpreter/elementInterpreter/tablePartial';
import { RecordsInterpreter } from '@/core/interpreter/records';
import Report from '@/core/report';
import { getElementKind } from '@/core/binder/utils';
import { ElementKind } from '@/core/binder/types';
import { CompileWarning } from '../errors';

function processColumnInDb<T extends Table | TablePartial> (table: T): T {
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

function convertEnvToDb (env: InterpreterDatabase, filepath: Filepath): Database {
  // Convert records Map to array of TableRecord
  const records: TableRecord[] = [];
  for (const [table, block] of env.records) {
    if (!block.length) continue;
    const columns = Object.keys(block[0].columnNodes);
    records.push({
      schemaName: table.schemaName || undefined,
      tableName: table.name,
      columns,
      values: block.map((r) => {
        // Convert object-based values to array-based values ordered by columns
        return columns.map((col) => {
          const val = r.values[col];
          if (val) {
            return { value: val.value, type: val.type };
          }
          return { value: null, type: 'expression' };
        });
      }),
    });
  }

  return {
    filepath,
    schemas: [],
    tables: Array.from(env.tables.values()).map(processColumnInDb),
    notes: Array.from(env.notes.values()),
    refs: Array.from(env.ref.values()),
    enums: Array.from(env.enums.values()),
    tableGroups: Array.from(env.tableGroups.values()),
    aliases: env.aliases,
    project: Array.from(env.project.values())[0] || {},
    tablePartials: Array.from(env.tablePartials.values()).map(processColumnInDb),
    records,
  };
}

// The interpreted format follows the old parser
export default class Interpreter {
  compiler: Compiler;
  ast: ProgramNode;
  env: InterpreterDatabase;

  constructor (
    compiler: Compiler,
    { ast, nodeToSymbol, nodeToReferee }: AnalysisResult & { ast: ProgramNode },
    { tablePartials }: {
      tablePartials?: InterpreterDatabase['tablePartials'];
    } = {},
  ) {
    this.compiler = compiler;
    this.ast = ast;
    this.env = {
      schema: [],
      tables: new Map(),
      notes: new Map(),
      refIds: { },
      ref: new Map(),
      enums: new Map(),
      tableOwnerGroup: { },
      tableGroups: new Map(),
      aliases: [],
      project: new Map(),
      tablePartials: tablePartials ?? new Map(),
      records: new Map(),
      recordsElements: [],
      cachedMergedTables: new Map(),
      source: ast.source,
    };
  }

  interpret (): Report<Database> {
    // First pass: interpret all non-records elements
    const errors = this.ast.declarations.flatMap((element) => {
      switch (getElementKind(element).unwrap_or(undefined)) {
        case ElementKind.Table:
          return (new TableInterpreter(
            this.compiler,
            element,
            this.env,
          )).interpret();
        case ElementKind.Note:
          return (new StickyNoteInterpreter(
            this.compiler,
            element,
            this.env,
          )).interpret();
        case ElementKind.Ref:
          return (new RefInterpreter(
            this.compiler,
            element,
            this.env,
          )).interpret();
        case ElementKind.TableGroup:
          return (new TableGroupInterpreter(
            this.compiler,
            element,
            this.env,
          )).interpret();
        case ElementKind.TablePartial:
          return (new TablePartialInterpreter(
            this.compiler,
            element,
            this.env,
          )).interpret();
        case ElementKind.Enum:
          return (new EnumInterpreter(
            this.compiler,
            element,
            this.env,
          )).interpret();
        case ElementKind.Project:
          return (new ProjectInterpreter(
            this.compiler,
            element,
            this.env,
          )).interpret();
        case ElementKind.Records:
          // Defer records interpretation - collect for later
          this.env.recordsElements.push(element);
          return [];
        default:
          return [];
      }
    });

    const warnings: CompileWarning[] = [];
    if (this.env.recordsElements.length) {
    // Second pass: interpret all records elements grouped by table
    // Now that all tables, enums, etc. are interpreted, we can validate records properly
      const recordsResult = new RecordsInterpreter(
        this.compiler,
        this.env,
      ).interpret(this.env.recordsElements);
      errors.push(...recordsResult.getErrors());
      warnings.push(...recordsResult.getWarnings());
    }

    return new Report(convertEnvToDb(this.env, this.ast.filepath), errors, warnings);
  }
}
