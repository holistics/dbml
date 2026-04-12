import {
  CompileError, CompileWarning,
} from '@/core/types/errors';

export interface ElementValidator {
  validate(): { errors: CompileError[];
    warnings: CompileWarning[]; };
}
