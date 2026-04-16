import type Compiler from '@/compiler';
import {
  DEFAULT_ENTRY, DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  Database,
} from '@/core/types';
import type {
  CompileError, CompileWarning,
} from '@/core/types/errors';
import {
  type Filepath,
} from '@/core/types/filepath';
import {
  UNHANDLED,
} from '@/core/types/module';
import type {
  ProgramNode,
} from '@/core/types/nodes';
import {
  type NodeSymbol, SchemaSymbol,
} from '@/core/types/symbol';
import type {
  SyntaxToken,
} from '@/core/types/tokens';

export function ast (this: Compiler, filepath: Filepath): Readonly<ProgramNode> {
  return this.parseFile(filepath).getValue().ast;
}

export function errors (this: Compiler): readonly Readonly<CompileError>[] {
  return this.interpretFile(DEFAULT_ENTRY).getErrors();
}

export function warnings (this: Compiler): readonly Readonly<CompileWarning>[] {
  return this.interpretFile(DEFAULT_ENTRY).getWarnings();
}

export function tokens (this: Compiler, filepath: Filepath): readonly Readonly<SyntaxToken>[] {
  return this.parseFile(filepath).getValue().tokens;
}

export function rawDb (this: Compiler): Readonly<Database> | undefined {
  const ast = this.parseFile(DEFAULT_ENTRY).getValue().ast;
  return this.interpretNode(ast).getFiltered(UNHANDLED) as Database | undefined;
}

export function publicSymbolTable (this: Compiler): readonly Readonly<NodeSymbol>[] | undefined {
  const astNode = this.parseFile(DEFAULT_ENTRY).getValue().ast;
  const sym = this.nodeSymbol(astNode);
  if (sym.hasValue(UNHANDLED)) return undefined;
  const programMembers = this.symbolMembers(sym.getValue());
  if (programMembers.hasValue(UNHANDLED)) return undefined;

  const result: NodeSymbol[] = [];
  for (const member of programMembers.getValue()) {
    result.push(member);
  }
  return result;
}
