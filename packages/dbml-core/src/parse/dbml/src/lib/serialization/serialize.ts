import { CompileError } from '../errors';
import { ProgramNode } from '../parser/nodes';
import Report from '../report';

export function serialize(report: Report<ProgramNode, CompileError>): string {
  return JSON.stringify(
    report,
    (key, value) => (['symbol', 'parentElement'].includes(key) ? undefined : value),
    2,
  );
}
