import type Compiler from '../index';
import type { ProgramNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { Database } from '@/core/interpreter/types';
import type SymbolTable from '@/core/analyzer/symbol/symbolTable';
import type { SymbolToReferencesMap } from '@/core/analyzer/analyzer';

export function ast (this: Compiler): Readonly<ProgramNode> {
  return this.parseFile().getValue().ast;
}

export function errors (this: Compiler): readonly Readonly<CompileError>[] {
  return this.parse._().getErrors();
}

export function warnings (this: Compiler): readonly Readonly<CompileWarning>[] {
  return this.parse._().getWarnings();
}

export function tokens (this: Compiler): readonly Readonly<SyntaxToken>[] {
  return this.parseFile().getValue().tokens;
}

export function rawDb (this: Compiler): Readonly<Database> | undefined {
  return this.parse._().getValue();
}

export function symbolToReferences (this: Compiler): Readonly<SymbolToReferencesMap> | undefined {
  return this.analyzeFile().getValue().symbolToReferences;
}

export function publicSymbolTable (this: Compiler): Readonly<SymbolTable> {
  const { ast, nodeToSymbol: map } = this.analyzeFile().getValue();
  return map!.get(ast)!.symbolTable!;
}
