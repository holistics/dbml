import { CompileError } from '../../errors';

export interface ElementValidator {
  validate(): CompileError[];
}
