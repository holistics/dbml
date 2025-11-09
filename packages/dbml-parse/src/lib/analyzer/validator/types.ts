import { CompileError } from '@lib/errors';

export interface ElementValidator {
  validate(): CompileError[];
}
