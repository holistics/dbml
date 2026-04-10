import { CompileError } from '@/core/types/errors';

export interface ElementValidator {
  validate(): CompileError[];
}
