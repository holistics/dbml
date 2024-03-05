import { CompileError } from '../../errors';

export interface ElementBinder {
  bind(): CompileError[];
}
