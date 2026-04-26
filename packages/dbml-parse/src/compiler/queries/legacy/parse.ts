import {
  DEFAULT_ENTRY,
} from '@/constants';
import type {
  CompileError, CompileWarning,
} from '@/core/types/errors';
import {
  type Filepath,
} from '@/core/types/filepath';
import type {
  ProgramNode,
} from '@/core/types/nodes';
import type {
  Database,
} from '@/core/types/schemaJson';
import type SymbolTable from '@/core/types/symbol/symbolTable';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import type Compiler from '../../index';

export function ast (this: Compiler, filepath: Filepath): Readonly<ProgramNode> {
  return this.parseFile(filepath).getValue().ast;
}

export function errors (this: Compiler, filepath: Filepath): readonly Readonly<CompileError>[] {
  return this.interpretFile(filepath).getErrors();
}

export function warnings (this: Compiler, filepath: Filepath): readonly Readonly<CompileWarning>[] {
  return this.interpretFile(filepath).getWarnings();
}

export function tokens (this: Compiler, filepath: Filepath): readonly Readonly<SyntaxToken>[] {
  return this.parseFile(filepath).getValue().tokens;
}

export function rawDb (this: Compiler, filepath: Filepath): Readonly<Database> | undefined {
  return this.interpretFile(filepath).getValue() ?? undefined;
}

export function publicSymbolTable (this: Compiler, filepath: Filepath): Readonly<SymbolTable> {
  return this.parseFile(filepath).getValue().ast.symbol!.symbolTable!;
}
