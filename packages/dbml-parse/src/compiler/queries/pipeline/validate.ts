import Validator from '@/core/local_modules/program/validate';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  ProgramNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type Compiler from '../../index';

export function validateFile (this: Compiler, filepath: Filepath): Report<ProgramNode> {
  return this.parseFile(filepath).chain(({
    ast,
  }) =>
    new Validator(ast, this.symbolFactory).validate(),
  );
}
