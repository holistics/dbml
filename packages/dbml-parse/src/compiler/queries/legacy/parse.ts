import type Compiler from '../../index';
import type { ProgramNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import type { CompileError, CompileWarning } from '@/core/errors';
import { type NodeSymbol, SchemaSymbol } from '@/core/types/symbols';
import { DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';

export function ast (this: Compiler): Readonly<ProgramNode> {
  return this.parseFile().getValue().ast;
}

function compile (compiler: Compiler) {
  const parseResult = compiler.parseFile();
  const astNode = parseResult.getValue().ast;
  compiler.bind(astNode);
  const interpretResult = compiler.interpret(astNode);
  return { parseResult, interpretResult };
}

export function errors (this: Compiler): readonly Readonly<CompileError>[] {
  const { parseResult, interpretResult } = compile(this);
  return [...parseResult.getErrors(), ...interpretResult.getErrors()];
}

export function warnings (this: Compiler): readonly Readonly<CompileWarning>[] {
  const { parseResult, interpretResult } = compile(this);
  return [...parseResult.getWarnings(), ...interpretResult.getWarnings()];
}

export function tokens (this: Compiler): readonly Readonly<SyntaxToken>[] {
  return this.parseFile().getValue().tokens;
}

export function publicSymbolTable (this: Compiler): readonly Readonly<NodeSymbol>[] | undefined {
  const astNode = this.parseFile().getValue().ast;
  const sym = this.nodeSymbol(astNode);
  if (sym.hasValue(UNHANDLED)) return undefined;
  const programMembers = this.symbolMembers(sym.getValue());
  if (programMembers.hasValue(UNHANDLED)) return undefined;

  // Program symbolMembers flattens public schema, but we also need non-public schema contents
  const result: NodeSymbol[] = [];
  for (const member of programMembers.getValue()) {
    result.push(member);
    if (member instanceof SchemaSymbol && member.name !== DEFAULT_SCHEMA_NAME) {
      const schemaMembers = this.symbolMembers(member);
      if (!schemaMembers.hasValue(UNHANDLED)) {
        result.push(...schemaMembers.getValue());
      }
    }
  }
  return result;
}
