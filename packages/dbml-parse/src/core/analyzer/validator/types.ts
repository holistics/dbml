import { ElementDeclarationNode } from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { NodeToSymbolMap } from '@/core/analyzer/analyzer';
import { CompileError } from '@/core/errors';

export interface ElementValidatorArgs {
  declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  publicSymbolTable: SymbolTable;
  nodeToSymbol: NodeToSymbolMap;
}

export interface ElementValidatorResult {
  errors: CompileError[];
}

export interface ElementValidator {
  validate(): ElementValidatorResult;
}
