import Binder from '@/core/global_modules/program/bind';
import Interpreter from '@/core/global_modules/program/interpret';
import Validator from '@/core/local_modules/program/validate';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  Database,
} from '@/core/types/schemaJson';
import Report from '@/core/types/report';
import type Compiler from '../../index';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  return this.parseFile(filepath).chain(({
    ast,
  }) => {
    const validateResult = new Validator(ast, this.symbolFactory).validate();
    if (validateResult.getErrors().length > 0) {
      return validateResult.map(() => undefined);
    }
    return validateResult.chain((program) => {
      const bindResult = new Binder(program, this.symbolFactory).resolve();
      if (bindResult.getErrors().length > 0) {
        return bindResult.map(() => undefined);
      }
      return bindResult.chain(() => new Interpreter(ast).interpret());
    });
  });
}
