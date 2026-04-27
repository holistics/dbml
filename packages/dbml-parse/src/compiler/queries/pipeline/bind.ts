import Binder from '@/core/global_modules/program/bind';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  ProgramNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type Compiler from '../../index';

export function bindFile (this: Compiler, filepath: Filepath): Report<ProgramNode> {
  return this.validateFile(filepath).chain((program) =>
    new Binder(program, this.symbolFactory).resolve(),
  );
}
