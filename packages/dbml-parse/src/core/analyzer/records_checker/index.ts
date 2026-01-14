import { ProgramNode } from '@/core/parser/nodes';
import Report from '@/core/report';
import { CompileError } from '@/core/errors';

// RecordsChecker runs after the binder to perform additional validation on records.
// This includes checking that:
//   - Column count in data rows matches the column list in the records name
//   - Data types are compatible with column types
export class RecordsChecker {
  private ast: ProgramNode;

  constructor (ast: ProgramNode) {
    this.ast = ast;
  }

  check (): Report<ProgramNode, CompileError> {
    const errors: CompileError[] = [];

    // TODO: Implement records checking logic

    return new Report(this.ast, errors);
  }
}
