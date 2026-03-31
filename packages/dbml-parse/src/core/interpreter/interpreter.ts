import type Compiler from '@/compiler/index';
import { ProgramNode } from '@/core/parser/nodes';
import { InterpreterDatabase } from '@/core/interpreter/types';
import { TableInterpreter } from '@/core/interpreter/elementInterpreter/table';
import { StickyNoteInterpreter } from '@/core/interpreter/elementInterpreter/stickyNote';
import { RefInterpreter } from '@/core/interpreter/elementInterpreter/ref';
import { TableGroupInterpreter } from '@/core/interpreter/elementInterpreter/tableGroup';
import { EnumInterpreter } from '@/core/interpreter/elementInterpreter/enum';
import { ProjectInterpreter } from '@/core/interpreter/elementInterpreter/project';
import { TablePartialInterpreter } from '@/core/interpreter/elementInterpreter/tablePartial';
import { RecordsInterpreter } from '@/core/interpreter/records';
import Report from '@/core/report';
import { getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import { CompileWarning } from '../errors';

// The interpreted format follows the old parser
export default class Interpreter {
  compiler: Compiler;
  ast: ProgramNode;
  env: InterpreterDatabase;

  constructor (
    compiler: Compiler,
    ast: ProgramNode,
    env: InterpreterDatabase,
  ) {
    this.compiler = compiler;
    this.ast = ast;
    this.env = env;
  }

  interpret (): Report<void> {
    const errors = this.ast.declarations.flatMap((element) => {
      switch (getElementKind(element).unwrap_or(undefined)) {
        case ElementKind.Table:
          return (new TableInterpreter(this.compiler, this.ast, element, this.env)).interpret();
        case ElementKind.Note:
          return (new StickyNoteInterpreter(this.compiler, this.ast, element, this.env)).interpret();
        case ElementKind.Ref:
          return (new RefInterpreter(this.compiler, this.ast, element, this.env)).interpret();
        case ElementKind.TableGroup:
          return (new TableGroupInterpreter(this.compiler, this.ast, element, this.env)).interpret();
        case ElementKind.TablePartial:
          return (new TablePartialInterpreter(this.compiler, this.ast, element, this.env)).interpret();
        case ElementKind.Enum:
          return (new EnumInterpreter(this.compiler, this.ast, element, this.env)).interpret();
        case ElementKind.Project:
          return (new ProjectInterpreter(this.compiler, this.ast, element, this.env)).interpret();
        case ElementKind.Records:
          this.env.recordsElements.push(element);
          return [];
        default:
          return [];
      }
    });

    const warnings: CompileWarning[] = [];
    if (this.env.recordsElements.length) {
      const recordsResult = new RecordsInterpreter(this.compiler, this.ast, this.env).interpret(this.env.recordsElements);
      errors.push(...recordsResult.getErrors());
      warnings.push(...recordsResult.getWarnings());
    }

    return new Report(undefined, errors, warnings);
  }
}
