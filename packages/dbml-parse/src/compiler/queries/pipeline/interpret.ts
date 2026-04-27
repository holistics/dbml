import Interpreter from '@/core/global_modules/program/interpret';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  Database,
} from '@/core/types/schemaJson';
import Report from '@/core/types/report';
import type Compiler from '../../index';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  const bindResult = this.bindFile(filepath);
  if (bindResult.getErrors().length > 0) {
    return bindResult.map(() => undefined);
  }
  const {
    ast,
  } = this.parseFile(filepath).getValue();
  return bindResult.chain(() => new Interpreter(ast).interpret());
}
