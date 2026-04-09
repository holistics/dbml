import type Compiler from '@/compiler';
import { UNHANDLED } from '@/constants';
import type Report from '@/core/report';
import type { Database } from '@/core/types';
import { Filepath } from '@/core/types/filepath';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  const ast = this.parseFile(filepath).getValue().ast;
  return this.interpretNode(ast).map((v) => v === UNHANDLED ? undefined : v as Database);
}

export function interpretProject (this: Compiler): Report<Readonly<Database> | undefined> {
  // FIXME
  throw new Error('UNIMPLEMENTED');
}
