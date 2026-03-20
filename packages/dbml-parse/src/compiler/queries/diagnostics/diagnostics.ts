import type Compiler from '../../index';
import type { CompileError, CompileWarning } from '@/core/errors';

export function errors (this: Compiler): readonly CompileError[] {
  return this.bindFile().getErrors();
}

export function warnings (this: Compiler): readonly CompileWarning[] {
  return this.bindFile().getWarnings();
}
