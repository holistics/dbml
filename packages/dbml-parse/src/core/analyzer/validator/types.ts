import { CompileError, CompileWarning } from '@/core/errors';

export interface ElementValidator {
  validate(): { errors: CompileError[]; warnings: CompileWarning[] };
}
