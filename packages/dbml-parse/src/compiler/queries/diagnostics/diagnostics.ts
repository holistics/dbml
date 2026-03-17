import type Compiler from '../../index';
import type { CompileError, CompileWarning } from '@/core/errors';

export function errors (this: Compiler): readonly CompileError[] {
  return this.analyzeProject().getErrors();
}

export function warnings (this: Compiler): readonly CompileWarning[] {
  return this.analyzeProject().getWarnings();
}
