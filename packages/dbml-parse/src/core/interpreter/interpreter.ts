import { ProgramNode } from '@/core/parser/nodes';
import { CompileError } from '@/core/errors';
import { Database, InterpreterDatabase, TableRecord } from '@/core/interpreter/types';
import { TableInterpreter } from '@/core/interpreter/elementInterpreter/table';
import { StickyNoteInterpreter } from '@/core/interpreter/elementInterpreter/sticky_note';
import { RefInterpreter } from '@/core/interpreter/elementInterpreter/ref';
import { TableGroupInterpreter } from '@/core/interpreter/elementInterpreter/tableGroup';
import { EnumInterpreter } from '@/core/interpreter/elementInterpreter/enum';
import { ProjectInterpreter } from '@/core/interpreter/elementInterpreter/project';
import { TablePartialInterpreter } from '@/core/interpreter/elementInterpreter/tablePartial';
import { RecordsInterpreter } from '@/core/interpreter/records';
import Report from '@/core/report';
import { getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';

function convertEnvToDb (env: InterpreterDatabase): Database {
  // Convert records Map to array of TableRecord
  const records: TableRecord[] = [];
  for (const [table, rows] of env.records) {
    if (rows.length > 0) {
      // Collect all unique column names from all rows
      const columnsSet = new Set<string>();
      for (const row of rows) {
        for (const colName of Object.keys(row.values)) {
          columnsSet.add(colName);
        }
      }

      records.push({
        schemaName: table.schemaName || undefined,
        tableName: table.name,
        columns: Array.from(columnsSet),
        values: rows.map((r) => r.values),
      });
    }
  }

  return {
    schemas: [],
    tables: Array.from(env.tables.values()),
    notes: Array.from(env.notes.values()),
    refs: Array.from(env.ref.values()),
    enums: Array.from(env.enums.values()),
    tableGroups: Array.from(env.tableGroups.values()),
    aliases: env.aliases,
    project: Array.from(env.project.values())[0] || {},
    tablePartials: Array.from(env.tablePartials.values()),
    records,
  };
}

// The interpreted format follows the old parser
export default class Interpreter {
  ast: ProgramNode;
  env: InterpreterDatabase;

  constructor (ast: ProgramNode) {
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
      tablePartials: new Map(),
      records: new Map(),
      recordsElements: [],
    };
  }

  interpret (): Report<Database, CompileError> {
    // First pass: interpret all non-records elements
    const errors = this.ast.body.flatMap((element) => {
      switch (getElementKind(element).unwrap_or(undefined)) {
        case ElementKind.Table:
          return (new TableInterpreter(element, this.env)).interpret();
        case ElementKind.Note:
          return (new StickyNoteInterpreter(element, this.env)).interpret();
        case ElementKind.Ref:
          return (new RefInterpreter(element, this.env)).interpret();
        case ElementKind.TableGroup:
          return (new TableGroupInterpreter(element, this.env)).interpret();
        case ElementKind.TablePartial:
          return (new TablePartialInterpreter(element, this.env)).interpret();
        case ElementKind.Enum:
          return (new EnumInterpreter(element, this.env)).interpret();
        case ElementKind.Project:
          return (new ProjectInterpreter(element, this.env)).interpret();
        case ElementKind.Records:
          // Defer records interpretation - collect for later
          this.env.recordsElements.push(element);
          return [];
        default:
          return [];
      }
    });

    // Second pass: interpret all records elements grouped by table
    // Now that all tables, enums, etc. are interpreted, we can validate records properly
    const recordsErrors = new RecordsInterpreter(this.env).interpret(this.env.recordsElements);
    errors.push(...recordsErrors);

    return new Report(convertEnvToDb(this.env), errors);
  }
}
