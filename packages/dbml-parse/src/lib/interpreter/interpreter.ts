import { ProgramNode } from '@/lib/parser/nodes';
import { CompileError } from '@/lib/errors';
import { Database, InterpreterDatabase } from '@/lib/interpreter/types';
import { TableInterpreter } from '@/lib/interpreter/elementInterpreter/table';
import { StickyNoteInterpreter } from '@/lib/interpreter/elementInterpreter/sticky_note';
import { RefInterpreter } from '@/lib/interpreter/elementInterpreter/ref';
import { TableGroupInterpreter } from '@/lib/interpreter/elementInterpreter/tableGroup';
import { EnumInterpreter } from '@/lib/interpreter/elementInterpreter/enum';
import { ProjectInterpreter } from '@/lib/interpreter/elementInterpreter/project';
import { TablePartialInterpreter } from '@/lib/interpreter/elementInterpreter/tablePartial';
import Report from '@/lib/report';
import { getElementKind } from '@/lib/analyzer/utils';
import { ElementKind } from '@/lib/analyzer/types';

function convertEnvToDb (env: InterpreterDatabase): Database {
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
      tableGroups: new Map(),
      groupOfTable: { },
      aliases: [],
      project: new Map(),
      tablePartials: new Map(),
    };
  }

  interpret (): Report<Database, CompileError> {
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
        default:
          return [];
      }
    });

    return new Report(convertEnvToDb(this.env), errors);
  }
}
