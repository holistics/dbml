import {
  type Filepath,
} from '@/core/types';
import type {
  CompileError, CompileWarning,
} from '@/core/types/errors';
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
  return this.parse._().getValue().ast;
}

export function errors (this: Compiler): readonly Readonly<CompileError>[] {
  return this.parse._().getErrors();
}

export function warnings (this: Compiler): readonly Readonly<CompileWarning>[] {
  return this.parse._().getWarnings();
}

export function tokens (this: Compiler, filepath: Filepath): Readonly<SyntaxToken>[] {
  return this.parse._().getValue().tokens;
}

export function rawDb (this: Compiler): Readonly<Database> | undefined {
  return this.parse._().getValue().rawDb;
}

export function publicSymbolTable (this: Compiler): Readonly<SymbolTable> {
  return this.parse._().getValue().ast.symbol!.symbolTable!;
}
