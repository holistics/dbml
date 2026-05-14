import type Compiler from '@/compiler';
import { Database } from '@/core/types';
import type { CompileError, CompileWarning } from '@/core/types/errors';
import { type Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import type { ProgramNode } from '@/core/types/nodes';
import { type NodeSymbol } from '@/core/types/symbol';
import type { SyntaxToken } from '@/core/types/tokens';

export function ast (this: Compiler, filepath: Filepath): Readonly<ProgramNode> {
  this.bindFile(filepath);
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
  const ast = this.parseFile(filepath).getValue().ast;
  const symbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!symbol) return undefined;
  return this.interpretSymbol(symbol, filepath).getFiltered(UNHANDLED) as Database | undefined;
}

export function publicSymbolTable (this: Compiler, filepath: Filepath): readonly Readonly<NodeSymbol>[] | undefined {
  const astNode = this.parseFile(filepath).getValue().ast;
  const sym = this.nodeSymbol(astNode).getFiltered(UNHANDLED);
  if (!sym) return undefined;
  return this.symbolMembers(sym).getFiltered(UNHANDLED);
}
