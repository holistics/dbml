import { CompileError } from '@/core/errors';

export interface ElementValidator {
  validate(): CompileError[];
}
