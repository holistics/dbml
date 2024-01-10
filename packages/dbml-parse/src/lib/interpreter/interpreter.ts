import { ProgramNode } from '../parser/nodes';
import { CompileError } from '../errors';
import { Database, InterpreterDatabase } from './types';
import { TableInterpreter } from './elementInterpreter/table';
import { RefInterpreter } from './elementInterpreter/ref';
import { TableGroupInterpreter } from './elementInterpreter/tableGroup';
import { EnumInterpreter } from './elementInterpreter/enum';
import { ProjectInterpreter } from './elementInterpreter/project';
import Report from '../report';
import { devNull } from 'os';

// The interpreted format follows the old parser
export default class Interpreter {
  ast: ProgramNode;
  env: InterpreterDatabase;

  constructor(ast: ProgramNode) {
    this.ast = ast;
    this.env = {
      schema: [],
      tables: new Map(),
      refIds: { },
      ref: new Map(),
      enums: new Map(),
      tableGroups: new Map(),
      aliases: [],
      project: new Map(),
    };
  }

  interpret(): Report<Database, CompileError> {
    const errors = this.ast.body.flatMap((element) => {
      switch (element.type!.value.toLowerCase()) {
        case 'table':
          return (new TableInterpreter(element, this.env)).interpret();
        case 'ref':
          return (new RefInterpreter(element, this.env)).interpret();
        case 'tablegroup':
          return (new TableGroupInterpreter(element, this.env)).interpret();
        case 'enum':
          return (new EnumInterpreter(element, this.env)).interpret();
        case 'project':
          return (new ProjectInterpreter(element, this.env)).interpret();
        default:
          return [];
      }
    });

    return new Report(convertEnvToDb(this.env), errors);
  }
}

function convertEnvToDb(env: InterpreterDatabase): Database {
  return {
    schemas: [],
    aliases: env.aliases,
    enums: Array.from(env.enums.values()),
    project: Array.from(env.project.values())[0] || {},
    refs: Array.from(env.ref.values()),
    tableGroups: Array.from(env.tableGroups.values()),
    tables: Array.from(env.tables.values()),
  };
}
