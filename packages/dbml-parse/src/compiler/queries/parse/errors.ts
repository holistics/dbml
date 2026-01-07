import type Compiler from '../../index';
import type { CompileError } from '@/core/errors';

export function errors (this: Compiler): readonly Readonly<CompileError>[] {
  return this.parse._().getErrors();
}
