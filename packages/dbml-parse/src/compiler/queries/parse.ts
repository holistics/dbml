import type Compiler from '../index';
import type { ProgramNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { Database } from '@/core/interpreter/types';
import type SymbolTable from '@/core/analyzer/symbol/symbolTable';

export function ast (this: Compiler): Readonly<ProgramNode> {
  return this.parse._().getValue().ast;
}

export function errors (this: Compiler): readonly Readonly<CompileError>[] {
  return this.parse._().getErrors();
}

export function warnings (this: Compiler): readonly Readonly<CompileWarning>[] {
  return this.parse._().getWarnings();
}

export function tokens (this: Compiler): Readonly<SyntaxToken>[] {
  return this.parse._().getValue().tokens;
}

export function rawDb (this: Compiler): Readonly<Database> | undefined {
  return this.parse._().getValue().rawDb;
}

export function publicSymbolTable (this: Compiler): Readonly<SymbolTable> {
  return this.parse._().getValue().ast.symbol!.symbolTable!;
}
