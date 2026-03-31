import type Compiler from '../../index';
import type { Filepath } from '../../projectLayout';
import type { CompileError, CompileWarning } from '@/core/errors';

export function fileErrors (this: Compiler, filepath: Filepath): readonly CompileError[] {
  return this.interpretProject().getErrors().filter((e) => e.nodeOrToken?.filepath?.equals(filepath));
}

export function fileWarnings (this: Compiler, filepath: Filepath): readonly CompileWarning[] {
  return this.interpretProject().getWarnings().filter((w) => w.nodeOrToken?.filepath?.equals(filepath));
}
