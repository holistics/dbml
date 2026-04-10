import type Compiler from '../../index';
import type { ProgramNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import type { CompileError, CompileWarning } from '@/core/types/errors';
import { type NodeSymbol, SchemaSymbol } from '@/core/types/symbols';
import { DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';
import { Database } from '@/core/types';

export function ast (this: Compiler): Readonly<ProgramNode> {
  return this.parseFile().getValue().ast;
}

export function errors (this: Compiler): readonly Readonly<CompileError>[] {
  return this.interpretFile().getErrors();
}

export function warnings (this: Compiler): readonly Readonly<CompileWarning>[] {
  return this.interpretFile().getWarnings();
}

export function tokens (this: Compiler): readonly Readonly<SyntaxToken>[] {
  return this.parseFile().getValue().tokens;
}

export function rawDb (this: Compiler): Readonly<Database> | undefined {
  const ast = this.parseFile().getValue().ast;
  return this.interpret(ast).getFiltered(UNHANDLED) as Database | undefined;
}

export function publicSymbolTable (this: Compiler): readonly Readonly<NodeSymbol>[] | undefined {
  const astNode = this.parseFile().getValue().ast;
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
