import type Compiler from '@/compiler';
import { UNHANDLED } from '@/constants';
import type Report from '@/core/report';
import type { Database } from '@/core/types';

export function interpretFile (this: Compiler): Report<Readonly<Database> | undefined> {
  const ast = this.parseFile().getValue().ast;
  return this.interpret(ast).map((v) => v === UNHANDLED ? undefined : v as Database);
}
