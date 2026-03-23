import type Compiler from '../../index';
import type { Filepath } from '../../projectLayout';
import { DEFAULT_ENTRY } from '../../constants';
import type { CompileError, CompileWarning } from '@/core/errors';

// Per-file diagnostics (includes lex, parse, validate, bind, and interpret errors/warnings)

export function fileErrors (this: Compiler, filepath: Filepath = DEFAULT_ENTRY): readonly CompileError[] {
  return this.interpretFile(filepath).getErrors();
}

export function fileWarnings (this: Compiler, filepath: Filepath = DEFAULT_ENTRY): readonly CompileWarning[] {
  return this.interpretFile(filepath).getWarnings();
}

// Project-wide diagnostics (aggregated across all files)

export function projectErrors (this: Compiler): readonly CompileError[] {
  return this.layout().listAllFiles().flatMap((fp) => this.fileErrors(fp));
}

export function projectWarnings (this: Compiler): readonly CompileWarning[] {
  return this.layout().listAllFiles().flatMap((fp) => this.fileWarnings(fp));
}
